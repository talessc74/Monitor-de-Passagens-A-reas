import type { ItineraryLeg } from '@mpa/types';
import { runScanSimulation } from './scanSimulator.js';

/**
 * Fase 9 ("Itinerários") — ver _local-bdr-plan-003. v1: grafo limitado a
 * uma lista curada de hubs (não o grafo global de aeroportos) e preços
 * via scanSimulator (Fase 7 troca a fonte por dados reais sem mudar este
 * algoritmo — mesmo padrão de _local-adr-policy-001).
 */

// Lista curada de hubs LATAM — ponto de partida do v1, ver "Não entra na
// v1" em _local-bdr-plan-003. Expansível por região no futuro.
export const CANDIDATE_HUBS = ['GRU', 'LIM', 'BOG', 'SCL', 'PTY', 'MIA', 'MCO'] as const;

export interface ItinerarySearchParams {
  origin: string;
  finalDestination: string;
  maxLegs: number;
  maxLayoverHours: number;
  allowOvernightLayovers: boolean;
  adults: number;
  children: number;
  targetPrice: number;
}

export interface ItinerarySearchResult {
  legs: ItineraryLeg[];
  total: number;
}

async function priceLeg(origin: string, destination: string, adults: number, children: number): Promise<{ price: number; carrier: string }> {
  const outcome = await runScanSimulation({
    originCity: origin,
    origin,
    destinationCity: destination,
    destination,
    adults,
    children,
    targetPrice: 0,
    sitesToScan: ['latam', 'gol', 'azul'],
  });
  const cheapest = outcome.results.reduce((min, r) => (r.price < min.price ? r : min), outcome.results[0]);
  return { price: cheapest.price, carrier: cheapest.site };
}

/**
 * Dijkstra sobre o grafo origin -> CANDIDATE_HUBS -> finalDestination,
 * limitado a params.maxLegs saltos. Overnight só é permitido explicitamente
 * (allowOvernightLayovers) — sem isso, layoverAfterHours > maxLayoverHours
 * descarta a aresta.
 */
export async function findCheapestItinerary(params: ItinerarySearchParams): Promise<ItinerarySearchResult | null> {
  const nodes = [params.origin, ...CANDIDATE_HUBS.filter((h) => h !== params.origin && h !== params.finalDestination), params.finalDestination];

  // distância mínima e predecessor por (nó, número de saltos usados) —
  // maxLegs é um teto duro de comprimento de caminho, não só de custo.
  type State = { node: string; legs: ItineraryLeg[]; total: number };
  let frontier: State[] = [{ node: params.origin, legs: [], total: 0 }];
  let best: State | null = null;

  for (let hop = 0; hop < params.maxLegs; hop++) {
    const next: State[] = [];
    for (const state of frontier) {
      if (state.node === params.finalDestination) continue;

      const candidates = nodes.filter((n) => n !== state.node && !state.legs.some((l) => l.origin === n));
      for (const dest of candidates) {
        const { price, carrier } = await priceLeg(state.node, dest, params.adults, params.children);
        // v1 não tem malha horária real (preço vem do simulador) — usa um
        // valor representativo de conexão same-day vs. pernoite, e só
        // descarta a aresta quando o teto do usuário é mais restrito que
        // isso. Fase 7 (dados reais) substitui por horários de voo de
        // verdade, mesmo padrão de troca de fonte de _local-adr-policy-001.
        const layoverHours = params.allowOvernightLayovers ? 18 : 3;
        if (!params.allowOvernightLayovers && layoverHours > params.maxLayoverHours) continue;

        const leg: ItineraryLeg = {
          origin: state.node,
          destination: dest,
          carrier,
          departureDate: new Date().toISOString().slice(0, 10),
          price,
          layoverAfterHours: dest === params.finalDestination ? undefined : layoverHours,
        };
        const candidateState: State = { node: dest, legs: [...state.legs, leg], total: state.total + price };

        if (dest === params.finalDestination) {
          if (!best || candidateState.total < best.total) {
            best = candidateState;
          }
        } else {
          next.push(candidateState);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  if (!best) return null;
  return { legs: best.legs, total: best.total };
}

/**
 * Só recomenda o itinerário multi-trecho se bater a baseline (passagem
 * direta) por uma margem mínima — critério de _local-bdr-plan-003.
 */
export function beatsBaselineByMargin(itineraryTotal: number, directBaselinePrice: number, marginPercent = 15): boolean {
  return itineraryTotal <= directBaselinePrice * (1 - marginPercent / 100);
}
