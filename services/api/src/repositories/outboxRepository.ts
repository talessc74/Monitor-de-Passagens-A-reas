import type { OutboxEvent } from '@mpa/types';
import { db, COLLECTIONS } from '../firestore.js';

const collection = () => db.collection(COLLECTIONS.outbox);

/**
 * Janela de dedup/throttle por tipo de evento — ver _local-adr-policy-002
 * (application). `target_reached` nunca é jogado fora (janela = o
 * próprio notificationId, único por evento); `price_update` throttla a
 * 1 e-mail por monitor por hora.
 */
function dedupWindow(type: OutboxEvent['type'], notificationId: string): string {
  if (type === 'target_reached') return notificationId;
  return String(Math.floor(Date.now() / 3_600_000));
}

/**
 * Grava um evento de outbox de forma idempotente: o id do documento é a
 * própria chave de dedup, criado com `.create()` (não `.set()`) — uma
 * segunda tentativa com a mesma chave falha com ALREADY_EXISTS, que é
 * ignorado silenciosamente (é exatamente o throttle funcionando).
 */
export async function createOutboxEvent(params: {
  type: OutboxEvent['type'];
  monitorId: string;
  userId: string | null;
  notificationId: string;
}): Promise<void> {
  const window = dedupWindow(params.type, params.notificationId);
  const dedupKey = `${params.monitorId}:${params.type}:${window}`;

  const event: OutboxEvent = {
    id: dedupKey,
    type: params.type,
    monitorId: params.monitorId,
    userId: params.userId,
    notificationId: params.notificationId,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    await collection().doc(dedupKey).create(event);
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 6 /* ALREADY_EXISTS */) {
      return; // throttlado — já existe um evento pendente/enviado nesta janela
    }
    throw error;
  }
}
