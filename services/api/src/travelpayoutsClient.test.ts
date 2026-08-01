import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('TRAVELPAYOUTS_API_TOKEN', '');

describe('getCheapestRealFare (no TRAVELPAYOUTS_API_TOKEN)', () => {
  it('returns null without calling fetch — off by default, like every optional integration', async () => {
    const { getCheapestRealFare } = await import('./travelpayoutsClient.js');
    const result = await getCheapestRealFare('GRU', 'GIG');
    expect(result).toBeNull();
  });
});

describe('getCheapestRealFare (with token, fetch mocked)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('TRAVELPAYOUTS_API_TOKEN', 'fake-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('returns the cheapest fare, marked estimated: false, site = gate name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { gate: 'Clickavia', value: 900, number_of_changes: 0, duration: 140 },
          { gate: 'Trip.com', value: 650, number_of_changes: 0, duration: 135 },
        ],
      }),
    }) as unknown as typeof fetch;

    const { getCheapestRealFare } = await import('./travelpayoutsClient.js');
    const result = await getCheapestRealFare('GRU', 'GIG');

    expect(result).not.toBeNull();
    expect(result!.price).toBe(650);
    expect(result!.site).toBe('Trip.com');
    expect(result!.estimated).toBe(false);
  });

  it('returns null when the route has no cached coverage (empty data)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }) as unknown as typeof fetch;

    const { getCheapestRealFare } = await import('./travelpayoutsClient.js');
    const result = await getCheapestRealFare('BSB', 'MIA');
    expect(result).toBeNull();
  });

  it('returns null (not throw) on an HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const { getCheapestRealFare } = await import('./travelpayoutsClient.js');
    const result = await getCheapestRealFare('GRU', 'GIG');
    expect(result).toBeNull();
  });

  it('returns null (not throw) when fetch itself rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const { getCheapestRealFare } = await import('./travelpayoutsClient.js');
    const result = await getCheapestRealFare('GRU', 'GIG');
    expect(result).toBeNull();
  });
});
