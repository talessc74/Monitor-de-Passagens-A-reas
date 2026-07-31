import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('GEMINI_API_KEY', '');

const { getRouteStats } = await import('./routeStats.js');

describe('getRouteStats (offline fallback, no GEMINI_API_KEY)', () => {
  it('estimates a higher price for an international route (LIS) than domestic', async () => {
    const international = await getRouteStats({
      origin: 'GRU',
      destination: 'LIS',
      searchMode: 'anytime',
      adults: 1,
      children: 0,
      infants: 0,
    } as any);
    const domestic = await getRouteStats({
      origin: 'GRU',
      destination: 'GIG',
      searchMode: 'anytime',
      adults: 1,
      children: 0,
      infants: 0,
    } as any);
    expect(international.average).toBeGreaterThan(domestic.average);
  });

  it('keeps min <= average <= max', async () => {
    const stats = await getRouteStats({
      origin: 'GRU',
      destination: 'GIG',
      searchMode: 'anytime',
      adults: 2,
      children: 1,
      infants: 1,
    } as any);
    expect(stats.min).toBeLessThanOrEqual(stats.average);
    expect(stats.max).toBeGreaterThanOrEqual(stats.average);
  });

  it('scales price up with more passengers', async () => {
    const solo = await getRouteStats({
      origin: 'GRU',
      destination: 'GIG',
      searchMode: 'anytime',
      adults: 1,
      children: 0,
      infants: 0,
    } as any);
    const family = await getRouteStats({
      origin: 'GRU',
      destination: 'GIG',
      searchMode: 'anytime',
      adults: 2,
      children: 2,
      infants: 0,
    } as any);
    expect(family.average).toBeGreaterThan(solo.average);
  });
});
