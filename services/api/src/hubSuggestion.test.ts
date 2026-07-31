import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('GEMINI_API_KEY', '');

const { suggestAdditionalHubs } = await import('./hubSuggestion.js');

describe('suggestAdditionalHubs (offline fallback, no GEMINI_API_KEY)', () => {
  it('returns an empty list instead of throwing or blocking the caller', async () => {
    const result = await suggestAdditionalHubs('GRU', 'MIA', ['LIM', 'BOG']);
    expect(result).toEqual([]);
  });
});
