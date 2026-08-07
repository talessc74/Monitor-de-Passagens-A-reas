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

  it('returns the cheapest fare, site = gate name', async () => {
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

describe('getRouteFareStats (_local-bdr-policy-016)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('TRAVELPAYOUTS_API_TOKEN', 'fake-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('computes average/min/max from the real fares actually returned', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { gate: 'A', value: 1000, number_of_changes: 0, duration: 120 },
          { gate: 'B', value: 2000, number_of_changes: 1, duration: 300 },
          { gate: 'C', value: 3000, number_of_changes: 0, duration: 130 },
        ],
      }),
    });

    const { getRouteFareStats } = await import('./travelpayoutsClient.js');
    const stats = await getRouteFareStats('GRU', 'GIG');

    expect(stats).not.toBeNull();
    expect(stats!.average).toBe(2000);
    expect(stats!.min).toBe(1000);
    expect(stats!.max).toBe(3000);
    // observations é contagem real, não estimativa — o ponto da policy.
    expect(stats!.observations).toBe(3);
  });

  it('returns null (never an invented estimate) when the route has no fares', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    const { getRouteFareStats } = await import('./travelpayoutsClient.js');
    expect(await getRouteFareStats('BSB', 'MCO')).toBeNull();
  });
});

describe('mapCoverage (_local-bdr-policy-016)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('TRAVELPAYOUTS_API_TOKEN', 'fake-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('totals routes across origins and counts distinct destinations', async () => {
    // Toda origem devolve os mesmos dois destinos: o total de rotas
    // soma por origem, mas os destinos distintos não multiplicam.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { gate: 'A', value: 500, number_of_changes: 0, duration: 100, destination: 'GIG' },
          { gate: 'B', value: 700, number_of_changes: 0, duration: 110, destination: 'SSA' },
        ],
      }),
    });

    const { mapCoverage, COVERAGE_SWEEP_ORIGINS } = await import('./travelpayoutsClient.js');
    const map = await mapCoverage();

    expect(map.configured).toBe(true);
    expect(map.origins).toHaveLength(COVERAGE_SWEEP_ORIGINS.length);
    expect(map.totalRoutes).toBe(COVERAGE_SWEEP_ORIGINS.length * 2);
    expect(map.uniqueDestinations).toBe(2);
    expect(map.origins[0].cheapest).toEqual({ destination: 'GIG', price: 500 });
  });

  it('reports a failing origin without losing the others — a partial map still informs the decision', async () => {
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) return { ok: false, status: 429 };
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{ gate: 'A', value: 500, number_of_changes: 0, duration: 100, destination: 'GIG' }],
        }),
      };
    });

    const { mapCoverage, COVERAGE_SWEEP_ORIGINS } = await import('./travelpayoutsClient.js');
    const map = await mapCoverage();

    expect(map.origins).toHaveLength(COVERAGE_SWEEP_ORIGINS.length);
    expect(map.origins.filter((o) => o.error)).toHaveLength(1);
    expect(map.totalRoutes).toBe(COVERAGE_SWEEP_ORIGINS.length - 1);
  });

  it('returns an unconfigured, empty map without a token', async () => {
    vi.stubEnv('TRAVELPAYOUTS_API_TOKEN', '');
    const { mapCoverage } = await import('./travelpayoutsClient.js');
    const map = await mapCoverage();
    expect(map.configured).toBe(false);
    expect(map.totalRoutes).toBe(0);
  });
});
