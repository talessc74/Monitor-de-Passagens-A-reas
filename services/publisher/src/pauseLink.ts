import { createHmac } from 'node:crypto';
import { env } from './env.js';

/**
 * Mint-only: gera o mesmo token HMAC que services/api/src/pauseLink.ts
 * verifica (verifyPauseToken). O publisher nunca precisa verificar, só
 * embutir o link no e-mail. Ver _local-edr-policy-004.
 */

function sign(monitorId: string, expiresAt: number): string {
  return createHmac('sha256', env.EMAIL_ACTION_SECRET).update(`${monitorId}:${expiresAt}`).digest('hex');
}

export function createPauseToken(monitorId: string): string {
  const expiresAt = Date.now() + env.PAUSE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;
  const signature = sign(monitorId, expiresAt);
  return `${expiresAt.toString(36)}.${signature}`;
}

export function buildPauseUrl(monitorId: string): string {
  const token = createPauseToken(monitorId);
  return `${env.API_PUBLIC_URL}/api/monitors/${monitorId}/pause?token=${token}`;
}
