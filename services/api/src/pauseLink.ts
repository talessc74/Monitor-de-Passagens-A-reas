import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

/**
 * Link de "pausar monitor" sem login — autoriza exatamente uma ação
 * (pausar) num único monitor, via assinatura HMAC, não um mecanismo
 * genérico de magic-link. Ver _local-edr-policy-004.
 */

function sign(monitorId: string, expiresAt: number): string {
  const secret = env.EMAIL_ACTION_SECRET ?? '';
  return createHmac('sha256', secret).update(`${monitorId}:${expiresAt}`).digest('hex');
}

export function createPauseToken(monitorId: string): string {
  const expiresAt = Date.now() + env.PAUSE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;
  const signature = sign(monitorId, expiresAt);
  return `${expiresAt.toString(36)}.${signature}`;
}

export function verifyPauseToken(monitorId: string, token: string): boolean {
  if (!env.EMAIL_ACTION_SECRET) return false;
  const [expiresAtPart, signaturePart] = token.split('.');
  if (!expiresAtPart || !signaturePart) return false;

  const expiresAt = parseInt(expiresAtPart, 36);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = sign(monitorId, expiresAt);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signaturePart, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
