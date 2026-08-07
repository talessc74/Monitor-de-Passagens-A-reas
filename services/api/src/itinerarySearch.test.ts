import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.stubEnv('GEMINI_API_KEY', '');

/**
 * Desde a _local-bdr-policy-016 o preço de trecho vem só de fonte real
 * (Travelpayouts) — não existe mais simulador atrás para garantir preço
 * a qualquer par. Por isso os testes agora controlam a cobertura
 * explicitamente: é justamente a cobertura que decide quais roteiros
 * existem, então ela precisa ser a variável do teste, não um acaso.
 */
const coveredPairs = new Map<string, number>();

vi.mock('./travelpayoutsClient.js', () => ({
  getCheapestRealFare: async (origin: string, destination: string) => {
    const price = coveredPairs.get(`${origin}-${destination}`);
    return price === undefined
      ? null
      : { site: 'Trip.com', price, durationHours: 4, stops: 0, isPromotion: false, details: 'teste' };
  },
}));

const { findCheapestItinerary, beatsBaselineByMargin, CANDIDATE_HUBS, MIN_CONNECTION_HOURS, LIABILITY_DISCLAIMER } = await import(
  './itinerarySearch.js'
);

/** Cobre todos os pares entre os nós informados, com um preço fixo por trecho. */
function coverAllPairs(nodes: string[], price: number) {
  for (const a of nodes) {
    for (const b of nodes) {
      if (a !== b) coveredPairs.set(`${a}-${b}`, price);
    }
  }
}

const baseParams = {
  origin: 'GRU',
  finalDestination: 'MIA',
  maxLegs: 3,
  maxLayoverHours: 6,
  allowOvernightLayovers: false,
  adults: 1,
  children: 0,
  targetPrice: 3000,
};

describe('findCheapestItinerary', () => {
  beforeEach(() => {
    coveredPairs.clear();
    // O cache de preço de trecho é por processo e vive 30min, então sem
    // limpar o módulo entre testes a primeira cobertura vazaria para os
    // seguintes.
    vi.resetModules();
  });

  it('returns null when no leg has a real price — an itinerary is never built on estimates', async () => {
    const { findCheapestItinerary: fresh } = await import('./itinerarySearch.js');
    const result = await fresh(baseParams);
    expect(result).toBeNull();
  });

  it('finds the direct 1-leg path when only that pair is covered', async () => {
    coveredPairs.set('GRU-MIA', 2000);
    const { findCheapestItinerary: fresh } = await import('./itinerarySearch.js');
    const result = await fresh({ ...baseParams, maxLegs: 1 });
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.legs[0].origin).toBe('GRU');
    expect(result!.legs[0].destination).toBe('MIA');
  });

  it('prefers a covered two-leg route when it totals less than the covered direct one', async () => {
    coveredPairs.set('GRU-MIA', 5000);
    coveredPairs.set('GRU-PTY', 1000);
    coveredPairs.set('PTY-MIA', 900);
    const { findCheapestItinerary: fresh } = await import('./itinerarySearch.js');
    const result = await fresh({ ...baseParams, maxLegs: 2, allowOvernightLayovers: true });
    expect(result).not.toBeNull();
    expect(result!.total).toBe(1900);
    expect(result!.legs.map((l) => l.destination)).toEqual(['PTY', 'MIA']);
  });

  it('skips a hub whose onward leg has no real price, even if the first leg is cheap', async () => {
    coveredPairs.set('GRU-MIA', 5000);
    // GRU→LIM é barato, mas LIM→MIA não tem preço real: o caminho via
    // LIM não pode ser recomendado, então o direto (caro) permanece.
    coveredPairs.set('GRU-LIM', 100);
    const { findCheapestItinerary: fresh } = await import('./itinerarySearch.js');
    const result = await fresh({ ...baseParams, maxLegs: 2, allowOvernightLayovers: true });
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
    expect(result!.total).toBe(5000);
  });

  it('never returns a path longer than maxLegs', async () => {
    coverAllPairs(['GRU', 'MIA', ...CANDIDATE_HUBS], 500);
    const { findCheapestItinerary: fresh } = await import('./itinerarySearch.js');
    const result = await fresh({ ...baseParams, maxLegs: 2, allowOvernightLayovers: true });
    expect(result).not.toBeNull();
    expect(result!.legs.length).toBeLessThanOrEqual(2);
  });

  it('every leg is a real hop between distinct nodes, ending at the final destination', async () => {
    coverAllPairs(['GRU', 'MIA', ...CANDIDATE_HUBS], 500);
    const { findCheapestItinerary: fresh } = await import('./itinerarySearch.js');
    const result = await fresh({ ...baseParams, allowOvernightLayovers: true });
    expect(result).not.toBeNull();
    for (const leg of result!.legs) {
      expect(leg.origin).not.toBe(leg.destination);
    }
    expect(result!.legs[result!.legs.length - 1].destination).toBe('MIA');
  });

  it('never returns a connection shorter than MIN_CONNECTION_HOURS', async () => {
    coverAllPairs(['GRU', 'MIA', ...CANDIDATE_HUBS], 500);
    const { findCheapestItinerary: fresh } = await import('./itinerarySearch.js');
    const result = await fresh({ ...baseParams, allowOvernightLayovers: true });
    expect(result).not.toBeNull();
    for (const leg of result!.legs) {
      if (leg.layoverAfterHours !== undefined) {
        expect(leg.layoverAfterHours).toBeGreaterThanOrEqual(MIN_CONNECTION_HOURS);
      }
    }
  });

  it('falls back to the direct itinerary when the layover cap makes every multi-hop path unsafe', async () => {
    coverAllPairs(['GRU', 'MIA', ...CANDIDATE_HUBS], 500);
    // maxLayoverHours abaixo do que qualquer conexão exige (3h) e sem
    // pernoite habilitado — nenhuma aresta via hub passa no filtro de
    // segurança, mas o trecho direto não é afetado por esse filtro.
    const { findCheapestItinerary: fresh } = await import('./itinerarySearch.js');
    const result = await fresh({ ...baseParams, maxLayoverHours: 1 });
    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(1);
  });

  it('lists MIA as one of the curated candidate hubs', () => {
    expect(CANDIDATE_HUBS).toContain('MIA');
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
