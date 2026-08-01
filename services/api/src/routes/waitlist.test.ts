import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Mesmo schema da rota — testado isolado, mesmo princípio de
// _local-bdr-plan-003 (schema extraído/testável sem subir o Fastify).
const waitlistSchema = z.object({
  email: z.string().email(),
  website: z.string().optional(),
});

describe('waitlistSchema', () => {
  it('accepts a valid email with no honeypot filled', () => {
    expect(waitlistSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
    expect(waitlistSchema.safeParse({ email: 'user@example.com', website: '' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(waitlistSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('accepts (does not 400) a payload with the honeypot filled — schema never reveals the filter to a bot', () => {
    const result = waitlistSchema.safeParse({ email: 'user@example.com', website: 'http://spam.example' });
    expect(result.success).toBe(true);
  });
});

describe('honeypot handler logic (silent no-op, not a validation error)', () => {
  function isBot(website: string | undefined): boolean {
    return Boolean(website && website.length > 0);
  }

  it('flags a filled honeypot as a bot', () => {
    expect(isBot('http://spam.example')).toBe(true);
  });

  it('does not flag an empty or absent honeypot', () => {
    expect(isBot('')).toBe(false);
    expect(isBot(undefined)).toBe(false);
  });
});
