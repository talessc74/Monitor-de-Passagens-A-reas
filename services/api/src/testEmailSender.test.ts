import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('RESEND_API_KEY', '');

describe('sendRealTestEmail (no RESEND_API_KEY)', () => {
  it('returns sent: false without calling fetch — no-op like every optional integration', async () => {
    const { sendRealTestEmail } = await import('./testEmailSender.js');
    const result = await sendRealTestEmail({ to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>' });
    expect(result).toEqual({ sent: false });
  });
});

describe('sendRealTestEmail (with key, fetch mocked)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RESEND_API_KEY', 'fake-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns sent: true on a successful Resend response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    const { sendRealTestEmail } = await import('./testEmailSender.js');
    const result = await sendRealTestEmail({ to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>' });
    expect(result).toEqual({ sent: true });
  });

  it('returns sent: false with the error body on an HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'invalid from address' }) as unknown as typeof fetch;
    const { sendRealTestEmail } = await import('./testEmailSender.js');
    const result = await sendRealTestEmail({ to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>' });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('422');
    expect(result.error).toContain('invalid from address');
  });

  it('returns sent: false (not throw) when fetch itself rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const { sendRealTestEmail } = await import('./testEmailSender.js');
    const result = await sendRealTestEmail({ to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>' });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('network down');
  });
});
