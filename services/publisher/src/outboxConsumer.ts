import type { OutboxEvent, NotificationLog, FlightMonitor } from '@mpa/types';
import { db, COLLECTIONS } from './firestore.js';
import { env } from './env.js';
import { sendEmail } from './resendClient.js';
import { targetReachedEmail, priceUpdateEmail } from './templates.js';

/**
 * Consome mpa_outbox via onSnapshot (tempo real) + poll de segurança a
 * cada POLL_INTERVAL_MS (cobre reconexões perdidas). Lease 'sending'
 * evita que as duas vias processem o mesmo evento em paralelo. Ver
 * _local-adr-policy-002 (application).
 */

async function claimEvent(eventId: string): Promise<OutboxEvent | null> {
  const ref = db.collection(COLLECTIONS.outbox).doc(eventId);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return null;
    const data = doc.data() as OutboxEvent;

    const leaseExpired =
      data.status === 'sending' &&
      data.sendingSince &&
      Date.now() - new Date(data.sendingSince).getTime() > env.SENDING_LEASE_MS;

    if (data.status !== 'pending' && !leaseExpired) return null;

    tx.update(ref, { status: 'sending', sendingSince: new Date().toISOString() });
    return { ...data, status: 'sending' };
  });
}

async function processEvent(event: OutboxEvent): Promise<void> {
  const ref = db.collection(COLLECTIONS.outbox).doc(event.id);

  try {
    const notificationDoc = await db.collection(COLLECTIONS.notifications).doc(event.notificationId).get();
    const notification = notificationDoc.data() as NotificationLog | undefined;
    if (!notification) {
      await ref.update({ status: 'failed', lastError: 'NotificationLog não encontrado' });
      return;
    }

    const monitorDoc = await db.collection(COLLECTIONS.monitors).doc(event.monitorId).get();
    const monitor = monitorDoc.data() as FlightMonitor | undefined;
    if (!monitor) {
      await ref.update({ status: 'failed', lastError: 'Monitor não encontrado' });
      return;
    }

    const { subject, html } =
      event.type === 'target_reached' ? targetReachedEmail(notification) : priceUpdateEmail(notification);

    await sendEmail({ to: monitor.email, subject, html });

    await ref.update({ status: 'sent', sentAt: new Date().toISOString() });
  } catch (error) {
    const attempts = event.attempts + 1;
    const lastError = error instanceof Error ? error.message : String(error);
    if (attempts >= env.MAX_SEND_ATTEMPTS) {
      await ref.update({ status: 'failed', attempts, lastError });
    } else {
      // Volta para 'pending' — próximo tick do poll (ou o próximo evento
      // no listener) tenta de novo, funcionando como backoff natural.
      await ref.update({ status: 'pending', attempts, lastError });
    }
  }
}

async function tryProcess(eventId: string): Promise<void> {
  const claimed = await claimEvent(eventId);
  if (!claimed) return;
  await processEvent(claimed);
}

async function pollPending(): Promise<void> {
  const snapshot = await db
    .collection(COLLECTIONS.outbox)
    .where('status', '==', 'pending')
    .get();
  await Promise.all(snapshot.docs.map((doc) => tryProcess(doc.id)));
}

let unsubscribe: (() => void) | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let stopped = false;

export function startConsumer() {
  unsubscribe = db
    .collection(COLLECTIONS.outbox)
    .where('status', '==', 'pending')
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            tryProcess(change.doc.id).catch((error) => {
              console.error('[publisher] erro processando evento do listener:', error);
            });
          }
        });
      },
      (error) => {
        console.error('[publisher] erro no listener do outbox:', error);
      }
    );

  const loop = async () => {
    if (stopped) return;
    try {
      await pollPending();
    } catch (error) {
      console.error('[publisher] erro no poll de segurança:', error);
    }
    if (!stopped) {
      pollTimer = setTimeout(loop, env.POLL_INTERVAL_MS);
    }
  };
  loop();
}

export function stopConsumer() {
  stopped = true;
  if (unsubscribe) unsubscribe();
  if (pollTimer) clearTimeout(pollTimer);
}
