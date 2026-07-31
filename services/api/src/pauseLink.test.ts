import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('EMAIL_ACTION_SECRET', 'a'.repeat(32));
vi.stubEnv('PAUSE_LINK_TTL_DAYS', '30');

const { createPauseToken, verifyPauseToken } = await import('./pauseLink.js');

describe('createPauseToken / verifyPauseToken', () => {
  it('accepts a token it just created for the same monitor', () => {
    const token = createPauseToken('monitor-1');
    expect(verifyPauseToken('monitor-1', token)).toBe(true);
  });

  it('rejects the token for a different monitor id', () => {
    const token = createPauseToken('monitor-1');
    expect(verifyPauseToken('monitor-2', token)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const token = createPauseToken('monitor-1');
    const [expiresAtPart] = token.split('.');
    const tampered = `${expiresAtPart}.${'0'.repeat(64)}`;
    expect(verifyPauseToken('monitor-1', tampered)).toBe(false);
  });

  it('rejects an expired token', () => {
    const expiresAt = Date.now() - 1000;
    const forgedExpiry = expiresAt.toString(36);
    const token = createPauseToken('monitor-1');
    const [, signaturePart] = token.split('.');
    expect(verifyPauseToken('monitor-1', `${forgedExpiry}.${signaturePart}`)).toBe(false);
  });

  it('rejects a malformed token', () => {
    expect(verifyPauseToken('monitor-1', 'not-a-valid-token')).toBe(false);
    expect(verifyPauseToken('monitor-1', '')).toBe(false);
  });
});
