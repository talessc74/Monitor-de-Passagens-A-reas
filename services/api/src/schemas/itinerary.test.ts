import { describe, expect, it } from 'vitest';
import { createItinerarySchema } from './itinerary.js';

const validBase = {
  origin: 'GRU',
  finalDestination: 'MIA',
  dateWindowStart: '2026-10-01',
  dateWindowEnd: '2026-10-30',
  targetPrice: 2000,
  email: 'user@example.com',
  riskAcknowledged: true as const,
};

describe('createItinerarySchema — riskAcknowledged (achado QA/PARETO+SCAFFOLD)', () => {
  it('accepts a payload with riskAcknowledged: true', () => {
    const result = createItinerarySchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects a payload without riskAcknowledged', () => {
    const { riskAcknowledged: _omit, ...withoutAck } = validBase;
    const result = createItinerarySchema.safeParse(withoutAck);
    expect(result.success).toBe(false);
  });

  it('rejects a payload with riskAcknowledged: false', () => {
    const result = createItinerarySchema.safeParse({ ...validBase, riskAcknowledged: false });
    expect(result.success).toBe(false);
  });
});

describe('createItinerarySchema — maxLayoverHours vs. MIN_CONNECTION_HOURS', () => {
  it('rejects maxLayoverHours below the safety minimum when overnight is not allowed', () => {
    const result = createItinerarySchema.safeParse({
      ...validBase,
      maxLayoverHours: 1,
      allowOvernightLayovers: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.maxLayoverHours).toBeDefined();
    }
  });

  it('accepts maxLayoverHours below the safety minimum when overnight IS allowed', () => {
    const result = createItinerarySchema.safeParse({
      ...validBase,
      maxLayoverHours: 1,
      allowOvernightLayovers: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts the default maxLayoverHours without overnight', () => {
    const result = createItinerarySchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });
});
