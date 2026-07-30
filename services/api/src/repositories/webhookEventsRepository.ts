import { db, COLLECTIONS } from '../firestore.js';

/**
 * Idempotência de webhooks do Stripe — mesmo padrão de dedup do outbox
 * (_local-adr-policy-002): grava o evento por `.create()` usando o
 * `event.id` do próprio Stripe como chave, antes de processar. Uma
 * segunda entrega do mesmo evento (Stripe reenvia por design) esbarra
 * em ALREADY_EXISTS e é ignorada. Ver _local-adr-policy-003.
 */
export async function claimWebhookEvent(eventId: string): Promise<boolean> {
  try {
    await db.collection(COLLECTIONS.webhookEvents).doc(eventId).create({
      id: eventId,
      receivedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 6 /* ALREADY_EXISTS */) {
      return false;
    }
    throw error;
  }
}
