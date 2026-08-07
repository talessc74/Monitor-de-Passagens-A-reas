import type { ItineraryLeg } from '@mpa/types';
import { getCheapestRealFare as getCheapestTravelpayoutsFare } from './travelpayoutsClient.js';
import { suggestAdditionalHubs } from './hubSuggestion.js';

/**
 * Fase 9 ("Itinerários") — ver _local-bdr-plan-003. v1: grafo limitado a
 * uma lista curada de hubs (não o grafo global de aeroportos), com preço
 * real por trecho via Travelpayouts. Trecho sem preço real não é aresta
 * do grafo (_local-bdr-policy-016), então a cobertura da fonte é o que
 * determina quais roteiros existem.
 */

// Lista curada de hubs LATAM — ponto de partida do v1, ver "Não entra na
// v1" em _local-bdr-plan-003. Expansível por região no futuro.
export const CANDIDATE_HUBS = ['GRU', 'LIM', 'BOG', 'SCL', 'PTY', 'MIA', 'MCO'] as const;

/**
 * Teto duro de segurança, não sugestão: nenhuma aresta do grafo é
 * considerada com menos que isso de conexão. Decisão do dono do produto
 * (2026-07-31) — o algoritmo não gera itinerário nenhum com conexão
 * apertada demais, em vez de gerar e só avisar. Valor conservador (v1
 * não distingue conexão doméstica de internacional, que tipicamente têm
 * mínimos diferentes — Fase 7, com dados reais de horário, pode refinar
 * por par de aeroportos).
 */
export const MIN_CONNECTION_HOURS = 1.5;

/**
 * Aviso de responsabilidade obrigatório — decisão do dono do produto
 * (2026-07-31): bilhetes separados não têm proteção de conexão entre si
 * (ao contrário de uma passagem única com trechos), e o FlySpot não se
 * responsabiliza por atraso, cancelamento ou falha de qualquer sistema
 * de voo que quebre a conexão entre bilhetes independentes. Retornado
 * pela API e exigido como reconhecimento explícito na criação do
 * itinerário (ver routes/itineraries.ts) — não é um texto de rodapé.
 */
export const LIABILITY_DISCLAIMER =
  'Itinerários com trechos separados não têm proteção de conexão entre si: ' +
  'se um voo atrasar ou for cancelado, você pode perder o próximo trecho sem ' +
  'reacomodação nem reembolso automático, diferente de uma passagem única ' +
  'com conexão. O FlySpot recomenda apenas conexões com tempo mínimo de ' +
  `${MIN_CONNECTION_HOURS}h entre o pouso e a decolagem seguinte, mas não se ` +
  'responsabiliza por atrasos, cancelamentos ou falhas de sistemas de voo ' +
  'das companhias aéreas. Confirme exigências de visto de trânsito antes de comprar.';

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

/**
 * Sempre retornado por `findCheapestItinerary`, ganhando ou perdendo pra
 * baseline — pra UI nunca ficar em silêncio sobre uma busca que rodou e
 * não achou nada melhor (achado de UX, _local-bdr-policy-014). `hubs` é
 * o grafo de fato considerado nesta chamada (CANDIDATE_HUBS + qualquer
 * sugestão do Gemini).
 */
export interface ItinerarySearchAttempt {
  hubs: string[];
  best: ItinerarySearchResult | null;
}

/**
 * Cache em memória por processo, chave origin-destination — o Dijkstra
 * abaixo testa até ~50 combinações de trecho num grafo de 7 hubs
 * curados; sem isso, cada scan 'anytime' bateria no Travelpayouts umas
 * 50 vezes, esgotando a cota rapidinho (mais ainda com Pro escaneando
 * de hora em hora, _local-bdr-policy-007). Preço entre dois aeroportos
 * fixos não precisa de frescor por segundo pra uma checagem de
 * viabilidade de conexão — 30min é suficiente e ainda barato. Ver
 * _local-bdr-policy-013.
 */
const LEG_PRICE_CACHE_TTL_MS = 30 * 60 * 1000;
const legPriceCache = new Map<string, { result: { price: number; carrier: string } | null; expiresAt: number }>();

/**
 * Preço real de um trecho, ou `null` quando não há cobertura pra esse
 * par — e `null` significa que o trecho não é caminho viável, não que
 * cabe estimar. Um itinerário é uma recomendação de compra: um roteiro
 * com preço inventado em qualquer perna vira um total inventado, e o
 * total é justamente o que decide se ele vence a passagem direta. Ver
 * _local-bdr-policy-016.
 *
 * Só Travelpayouts: o Sky Scrapper exige data de embarque por trecho
 * que este v1 não modela (o itinerário é "qualquer data", ver
 * _local-bdr-policy-013) e já vive sob risco de cota, então não faz
 * sentido multiplicar chamadas a ele por perna.
 *
 * A ausência também é cacheada — sem isso, uma rota sem cobertura
 * repetiria a mesma chamada perdida a cada aresta avaliada.
 */
async function priceLeg(origin: string, destination: string): Promise<{ price: number; carrier: string } | null> {
  const cacheKey = `${origin}-${destination}`;
  const cached = legPriceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const real = await getCheapestTravelpayoutsFare(origin, destination);
  const result = real ? { price: real.price, carrier: real.site } : null;

  legPriceCache.set(cacheKey, { result, expiresAt: Date.now() + LEG_PRICE_CACHE_TTL_MS });
  return result;
}

/**
 * Dijkstra sobre o grafo origin -> hubs -> finalDestination, limitado a
 * params.maxLegs saltos. Overnight só é permitido explicitamente
 * (allowOvernightLayovers) — sem isso, layoverAfterHours > maxLayoverHours
 * descarta a aresta.
 *
 * O grafo é CANDIDATE_HUBS (lista curada, estável) + até 5 hubs extras
 * sugeridos pelo Gemini para este par origin/finalDestination
 * especificamente (hubSuggestion.ts) — o Gemini só amplia o espaço de
 * busca, quem decide a combinação mais barata continua sendo o
 * Dijkstra abaixo, nunca o modelo. Falha ou ausência de GEMINI_API_KEY
 * na sugestão nunca impede a busca: cai de volta para só CANDIDATE_HUBS.
 */
export async function searchItinerary(params: ItinerarySearchParams): Promise<ItinerarySearchAttempt> {
  const suggestedHubs = await suggestAdditionalHubs(params.origin, params.finalDestination, CANDIDATE_HUBS);
  const allHubs = [...CANDIDATE_HUBS, ...suggestedHubs];
  const nodes = [params.origin, ...allHubs.filter((h) => h !== params.origin && h !== params.finalDestination), params.finalDestination];

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
        const priced = await priceLeg(state.node, dest);
        // Sem preço real pra esta perna, a aresta não existe: um roteiro
        // não pode ser recomendado com um trecho que a gente não sabe
        // quanto custa. Ver _local-bdr-policy-016.
        if (!priced) continue;
        const { price, carrier } = priced;
        // v1 não tem malha horária real — usa um valor representativo de
        // conexão same-day vs. pernoite. Uma fonte com horários de voo de
        // verdade substitui isso pelo mesmo padrão de troca de fonte de
        // _local-adr-policy-001 — mas o piso MIN_CONNECTION_HOURS vale
        // igual antes e depois dessa troca.
        const layoverHours = params.allowOvernightLayovers ? 18 : 3;
        // Filtro de segurança, não sugestão: descarta a aresta se a
        // conexão for curta demais (< MIN_CONNECTION_HOURS) ou mais longa
        // que o teto do usuário sem pernoite habilitado.
        if (dest !== params.finalDestination) {
          if (layoverHours < MIN_CONNECTION_HOURS) continue;
          if (!params.allowOvernightLayovers && layoverHours > params.maxLayoverHours) continue;
        }

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

  return { hubs: allHubs, best: best ? { legs: best.legs, total: best.total } : null };
}

/**
 * Wrapper de compatibilidade — mantido pro `executeItineraryScan.ts`
 * (`ItineraryMonitor`, Pro-only) que só precisa do resultado, não da
 * transparência de tentativa que `searchItinerary` acrescenta pro
 * "Modo Tieni" (_local-bdr-policy-014).
 */
export async function findCheapestItinerary(params: ItinerarySearchParams): Promise<ItinerarySearchResult | null> {
  return (await searchItinerary(params)).best;
}

/**
 * Só recomenda o itinerário multi-trecho se bater a baseline (passagem
 * direta) por uma margem mínima — critério de _local-bdr-plan-003.
 */
export function beatsBaselineByMargin(itineraryTotal: number, directBaselinePrice: number, marginPercent = 15): boolean {
  return itineraryTotal <= directBaselinePrice * (1 - marginPercent / 100);
}
