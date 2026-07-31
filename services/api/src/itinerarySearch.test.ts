import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('GEMINI_API_KEY', '');

const { findCheapestItinerary, beatsBaselineByMargin, CANDIDATE_HUBS, MIN_CONNECTION_HOURS, LIABILITY_DISCLAIMER } = await import(
  './itinerarySearch.js'
);

describe('findCheapestItinerary (offline simulation, no GEMINI_API_KEY)', () => {
  it('never returns a path longer than maxLegs', async () => {
    const result = await findCheapestItinerary({
      origin: 'GRU',
      finalDestination: 'MIA',
      maxLegs: 2,
      maxLayoverHours: 6,
      allowOvernightLayovers: false,
      adults: 1,
      children: 0,
      targetPrice: 3000,
    });
    expect(result).not.toBeNull();
    expect(result!.legs.length).toBeLessThanOrEqual(2);
  });

  it('every leg is a real hop between distinct candidate nodes', async () => {
    const result = await findCheapestItinerary({
      origin: 'GRU',
      finalDestination: 'MIA',
      maxLegs: 3,
      maxLayoverHours: 6,
      allowOvernightLayovers: false,
      adults: 1,
      children: 0,
      targetPrice: 3000,
    });
    expect(result).not.toBeNull();
    for (const leg of result!.legs) {
      expect(leg.origin).not.toBe(leg.destination);
    }
    expect(result!.legs[result!.legs.length - 1].destination).toBe('MIA');
  });

  it('finds a direct 1-leg path when maxLegs is 1', async () => {
    const result = await findCheapestItinerary({
      origin: 'GRU',
      finalDestination: 'MIA',
      maxLegs: 1,
      maxLayoverHours: 6,
      allowOvernightLayovers: false,
      adults: 1,
      children: 0,
      targetPrice: 3000,
    });
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.legs[0].origin).toBe('GRU');
    expect(result!.legs[0].destination).toBe('MIA');
  });

  it('lists MIA as one of the curated candidate hubs', () => {
    expect(CANDIDATE_HUBS).toContain('MIA');
  });

  it('never returns a connection shorter than MIN_CONNECTION_HOURS', async () => {
    const result = await findCheapestItinerary({
      origin: 'GRU',
      finalDestination: 'MIA',
      maxLegs: 3,
      maxLayoverHours: 6,
      allowOvernightLayovers: false,
      adults: 1,
      children: 0,
      targetPrice: 3000,
    });
    expect(result).not.toBeNull();
    for (const leg of result!.legs) {
      if (leg.layoverAfterHours !== undefined) {
        expect(leg.layoverAfterHours).toBeGreaterThanOrEqual(MIN_CONNECTION_HOURS);
      }
    }
  });

  it('falls back to the direct (1-leg) itinerary when the layover cap makes every multi-hop path unsafe', async () => {
    // maxLayoverHours abaixo do que qualquer conexão simulada exige (3h)
    // e sem pernoite habilitado — nenhuma aresta via hub passa no filtro
    // de segurança, mas o trecho direto (sem conexão nenhuma) não é
    // afetado por esse filtro, então ele continua sendo encontrado.
    const result = await findCheapestItinerary({
      origin: 'GRU',
      finalDestination: 'MIA',
      maxLegs: 3,
      maxLayoverHours: 1,
      allowOvernightLayovers: false,
      adults: 1,
      children: 0,
      targetPrice: 3000,
    });
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
  });
});

describe('LIABILITY_DISCLAIMER', () => {
  it('mentions no responsibility for delays/cancellations and the minimum connection time', () => {
    expect(LIABILITY_DISCLAIMER).toContain('não se responsabiliza');
    expect(LIABILITY_DISCLAIMER).toContain(`${MIN_CONNECTION_HOURS}h`);
  });
});

describe('beatsBaselineByMargin', () => {
  it('accepts an itinerary well below the margin threshold', () => {
    expect(beatsBaselineByMargin(800, 1000, 15)).toBe(true);
  });

  it('rejects an itinerary that barely beats the direct price', () => {
    expect(beatsBaselineByMargin(950, 1000, 15)).toBe(false);
  });

  it('rejects an itinerary more expensive than the baseline', () => {
    expect(beatsBaselineByMargin(1200, 1000, 15)).toBe(false);
  });
});
