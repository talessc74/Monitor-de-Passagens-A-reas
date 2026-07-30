import type { FlightMonitor, UserProfile } from '@mpa/types';
import { FieldValue } from 'firebase-admin/firestore';
import { db, COLLECTIONS } from './firestore.js';
import { env } from './env.js';

/**
 * Loop de polling — varre mpa_monitors vencidos a cada POLL_INTERVAL_MS
 * e dispara o scan via services/api (/internal/scan/:id). Ver
 * _local-adr-policy-002 e ROADMAP.md, Fase 4.
 */

interface TickStats {
  tickAt: string;
  due: number;
  scansAttempted: number;
  scansSucceeded: number;
  scansFailed: number;
  leaseSkipped: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function planIntervalHours(userId: string | null): Promise<number> {
  if (!userId) return env.FREE_SCAN_INTERVAL_HOURS;
  const doc = await db.collection(COLLECTIONS.users).doc(userId).get();
  const profile = doc.data() as UserProfile | undefined;
  return profile?.plan === 'pro' ? env.PRO_SCAN_INTERVAL_HOURS : env.FREE_SCAN_INTERVAL_HOURS;
}

/**
 * Lease por documento via transação — garante que, se mais de uma
 * instância do generator estiver rodando (autoscaling), só uma delas
 * escaneia cada monitor por ciclo. Retorna false se outra instância já
 * detém o lease.
 */
async function acquireLease(monitorId: string, now: number): Promise<boolean> {
  const ref = db.collection(COLLECTIONS.monitors).doc(monitorId);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return false;
    const data = doc.data() as FlightMonitor & { scanningLockedUntil?: string };
    if (data.status !== 'active') return false;
    if (data.scanningLockedUntil && new Date(data.scanningLockedUntil).getTime() > now) {
      return false;
    }
    tx.update(ref, { scanningLockedUntil: new Date(now + env.LEASE_DURATION_MS).toISOString() });
    return true;
  });
}

async function releaseLeaseAndReschedule(monitor: FlightMonitor, succeeded: boolean) {
  const ref = db.collection(COLLECTIONS.monitors).doc(monitor.id);
  if (succeeded) {
    const hours = await planIntervalHours(monitor.userId);
    const nextScanAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await ref.update({ scanningLockedUntil: FieldValue.delete(), nextScanAt });
  } else {
    // Falha: libera o lease e deixa nextScanAt como está — o monitor
    // continua "vencido" e é retentado no próximo tick, sem avançar o
    // relógio como se tivesse sido escaneado com sucesso.
    await ref.update({ scanningLockedUntil: FieldValue.delete() });
  }
}

async function scanOne(monitor: FlightMonitor): Promise<boolean> {
  try {
    const response = await fetch(`${env.API_INTERNAL_URL}/internal/scan/${monitor.id}`, {
      method: 'POST',
      headers: { 'X-Internal-Token': env.INTERNAL_SCAN_TOKEN },
    });
    return response.ok;
  } catch (error) {
    console.error(`[generator] falha ao chamar scan interno para ${monitor.id}:`, error);
    return false;
  }
}

async function recordHealth(stats: TickStats) {
  await db
    .collection(COLLECTIONS.system)
    .doc('schedulerHealth')
    .set(stats, { merge: false });
}

export async function tick(): Promise<TickStats> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const snapshot = await db
    .collection(COLLECTIONS.monitors)
    .where('status', '==', 'active')
    .where('nextScanAt', '<=', nowIso)
    .get();

  const dueMonitors = snapshot.docs.map((doc) => doc.data() as FlightMonitor);

  const stats: TickStats = {
    tickAt: nowIso,
    due: dueMonitors.length,
    scansAttempted: 0,
    scansSucceeded: 0,
    scansFailed: 0,
    leaseSkipped: 0,
  };

  for (const batch of chunk(dueMonitors, env.MAX_CONCURRENT_SCANS)) {
    await Promise.all(
      batch.map(async (monitor) => {
        const leased = await acquireLease(monitor.id, now);
        if (!leased) {
          stats.leaseSkipped += 1;
          return;
        }
        stats.scansAttempted += 1;
        const succeeded = await scanOne(monitor);
        if (succeeded) stats.scansSucceeded += 1;
        else stats.scansFailed += 1;
        await releaseLeaseAndReschedule(monitor, succeeded);
      })
    );
  }

  await recordHealth(stats);
  return stats;
}

let stopped = false;
let currentTimer: NodeJS.Timeout | null = null;

export function startScheduler() {
  async function loop() {
    if (stopped) return;
    try {
      const stats = await tick();
      if (stats.due > 0) {
        console.log(
          `[generator] tick: ${stats.due} vencidos, ${stats.scansAttempted} escaneados (${stats.scansSucceeded} ok, ${stats.scansFailed} falha), ${stats.leaseSkipped} com lease de outra instância`
        );
      }
    } catch (error) {
      console.error('[generator] erro no tick do scheduler:', error);
    }
    if (!stopped) {
      currentTimer = setTimeout(loop, env.POLL_INTERVAL_MS);
    }
  }
  loop();
}

export function stopScheduler() {
  stopped = true;
  if (currentTimer) clearTimeout(currentTimer);
}
