import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('RAPIDAPI_KEY', '');

describe('getCheapestRealFare (no RAPIDAPI_KEY)', () => {
  it('returns null without calling fetch — off by default, like every optional integration', async () => {
    const { getCheapestRealFare } = await import('./skyScrapperClient.js');
    const result = await getCheapestRealFare('GRU', 'MIA', '2026-09-15');
    expect(result).toBeNull();
  });
});

describe('getCheapestRealFare (no departureDate)', () => {
  it('returns null without calling fetch — anytime-mode monitors have no date to query', async () => {
    vi.stubEnv('RAPIDAPI_KEY', 'fake-key');
    const { getCheapestRealFare } = await import('./skyScrapperClient.js');
    const result = await getCheapestRealFare('GRU', 'MIA', null);
    expect(result).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe('getCheapestRealFare (with key, fetch mocked)', () => {
  const originalFetch = globalThis.fetch;

  const airportResponse = (skyId: string, entityId: string) => ({
    ok: true,
    json: async () => ({
      status: true,
      data: [{ navigation: { relevantFlightParams: { skyId, entityId } } }],
    }),
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RAPIDAPI_KEY', 'fake-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('resolves airports then returns the cheapest itinerary, marked estimated: false', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(airportResponse('GRU', '95673332'))
      .mockResolvedValueOnce(airportResponse('MIA', '95673821'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: true,
          data: {
            context: { status: 'complete' },
            itineraries: [
              { price: { raw: 770 }, legs: [{ durationInMinutes: 500, stopCount: 1, carriers: { marketing: [{ name: 'Avianca' }] } }] },
              { price: { raw: 256 }, legs: [{ durationInMinutes: 690, stopCount: 1, carriers: { marketing: [{ name: 'Avianca' }] } }] },
            ],
          },
        }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { getCheapestRealFare } = await import('./skyScrapperClient.js');
    const result = await getCheapestRealFare('GRU', 'MIA', '2026-09-15');

    expect(result).not.toBeNull();
    expect(result!.price).toBe(256);
    expect(result!.site).toBe('Avianca');
    expect(result!.estimated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries once on status: incomplete, then returns results from the retry', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(airportResponse('BSB', '95673410'))
      .mockResolvedValueOnce(airportResponse('MIA', '95673821'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: true, data: { context: { status: 'incomplete' }, itineraries: [] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: true,
          data: {
            context: { status: 'complete' },
            itineraries: [{ price: { raw: 412 }, legs: [{ durationInMinutes: 780, stopCount: 1, carriers: { marketing: [{ name: 'Copa' }] } }] }],
          },
        }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { getCheapestRealFare } = await import('./skyScrapperClient.js');
    const promise = getCheapestRealFare('BSB', 'MIA', '2026-09-15');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).not.toBeNull();
    expect(result!.price).toBe(412);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it('returns null when airport lookup finds no match', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, data: [] }) }) as unknown as typeof fetch;
    const { getCheapestRealFare } = await import('./skyScrapperClient.js');
    const result = await getCheapestRealFare('XXX', 'MIA', '2026-09-15');
    expect(result).toBeNull();
  });

  it('returns null (not throw) when fetch itself rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const { getCheapestRealFare } = await import('./skyScrapperClient.js');
    const result = await getCheapestRealFare('GRU', 'MIA', '2026-09-15');
    expect(result).toBeNull();
  });
});
