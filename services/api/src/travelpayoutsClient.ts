import type { ScanResult } from '@mpa/types';
import { env } from './env.js';

/**
 * Primeira fonte de preço real do FlySpot — ver _local-adr-policy-004
 * (application). Data API do Travelpayouts/Aviasales: cache de preços
 * observados de buscas reais (retenção 2-7 dias), não busca ao vivo —
 * cobertura confirmada real mas estreita (forte na ponte aérea SP-RJ,
 * ausente em rotas como Brasília nos testes do spike). Ver
 * _local-bdr-plan-004 pros dados brutos de teste.
 *
 * Diferente de Duffel/Amadeus, retorna por AGÊNCIA de venda ("gate":
 * Trip.com, Clickavia etc.), não por companhia aérea — ScanResult.site
 * carrega o nome do gate quando a fonte é real.
 */

interface TravelpayoutsFare {
  gate: string;
  value: number;
  number_of_changes: number;
  duration: number;
}

interface TravelpayoutsResponse {
  success: boolean;
  data: TravelpayoutsFare[];
}

/**
 * Item bruto de `/v2/prices/latest` quando consultado só com `origin`
 * (sem `destination`) — a API devolve o destino em cada item, já que
 * lista vários de uma vez. `TravelpayoutsFare` acima é o subconjunto
 * usado quando origin+destination já são conhecidos (destino é
 * implícito no parâmetro, não precisa vir de volta).
 */
interface TravelpayoutsFareWithDestination extends TravelpayoutsFare {
  destination: string;
  depart_date?: string;
  return_date?: string;
}

interface TravelpayoutsListResponse {
  success: boolean;
  data: TravelpayoutsFareWithDestination[];
}

/**
 * Retorna a tarifa mais barata em cache para origin->destination, ou
 * `null` se a fonte estiver desligada (sem token) ou sem cobertura pra
 * essa rota — nos dois casos o chamador cai pro simulador Gemini.
 * Nunca lança: qualquer falha de rede/parse também vira `null`.
 */
export async function getCheapestRealFare(origin: string, destination: string): Promise<ScanResult | null> {
  if (!env.TRAVELPAYOUTS_API_TOKEN) {
    return null;
  }

  try {
    const url = `https://api.travelpayouts.com/v2/prices/latest?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&currency=brl&token=${env.TRAVELPAYOUTS_API_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[api] Travelpayouts respondeu ${response.status} para ${origin}->${destination}`);
      return null;
    }
    const parsed = (await response.json()) as TravelpayoutsResponse;
    if (!parsed.success || !parsed.data || parsed.data.length === 0) {
      return null;
    }

    const cheapest = parsed.data.reduce((min, fare) => (fare.value < min.value ? fare : min), parsed.data[0]);
    return {
      site: cheapest.gate,
      price: cheapest.value,
      durationHours: Math.round(cheapest.duration / 60),
      stops: cheapest.number_of_changes,
      isPromotion: false,
      details: `Preço real observado via Travelpayouts (agência: ${cheapest.gate}).`,
    };
  } catch (error) {
    console.error(`[api] Erro ao consultar Travelpayouts para ${origin}->${destination}:`, error);
    return null;
  }
}

/**
 * Lista os destinos com tarifa em cache saindo de `origin`, mais barata
 * primeiro — ferramenta de diagnóstico pro painel /admin (_local-bdr-
 * policy-011), pra responder "quais rotas dessa origem têm cobertura
 * real" sem precisar cadastrar um monitor por destino pra descobrir na
 * marra. Mesma API de `getCheapestRealFare`, só sem fixar `destination`.
 * Nunca lança: falha de rede/parse vira `{ configured: true, error }`.
 */
export async function listCachedDestinations(
  origin: string
): Promise<{ configured: boolean; destinations: Array<{ destination: string; price: number; gate: string; stops: number }>; error?: string }> {
  if (!env.TRAVELPAYOUTS_API_TOKEN) {
    return { configured: false, destinations: [] };
  }
  try {
    const url = `https://api.travelpayouts.com/v2/prices/latest?origin=${encodeURIComponent(origin)}&currency=brl&limit=100&token=${env.TRAVELPAYOUTS_API_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { configured: true, destinations: [], error: `HTTP ${response.status}` };
    }
    const parsed = (await response.json()) as TravelpayoutsListResponse;
    if (!parsed.success || !parsed.data) {
      return { configured: true, destinations: [], error: 'Resposta em formato inesperado' };
    }
    const destinations = parsed.data
      .map((fare) => ({ destination: fare.destination, price: fare.value, gate: fare.gate, stops: fare.number_of_changes }))
      .sort((a, b) => a.price - b.price);
    return { configured: true, destinations };
  } catch (error) {
    return { configured: true, destinations: [], error: error instanceof Error ? error.message : 'Erro de rede desconhecido' };
  }
}

/**
 * Média/mínimo/máximo das tarifas REAIS em cache para origin→destination,
 * ou `null` quando não há nenhuma. Substitui a antiga estimativa gerada
 * por IA (`routeStats.ts` via Gemini): aqui `observations` é a contagem
 * de tarifas de fato observadas, não um número plausível — se não há
 * observação, a resposta é ausência, não um palpite. Ver
 * _local-bdr-policy-016.
 *
 * A janela amostral acompanha a retenção do cache do Travelpayouts
 * (poucos dias), não os 60 dias que a estimativa anterior alegava.
 */
export const REAL_SAMPLE_WINDOW_DAYS = 7;

export async function getRouteFareStats(
  origin: string,
  destination: string
): Promise<{ average: number; min: number; max: number; sampleWindowDays: number; observations: number } | null> {
  if (!env.TRAVELPAYOUTS_API_TOKEN) {
    return null;
  }

  try {
    const url = `https://api.travelpayouts.com/v2/prices/latest?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&currency=brl&token=${env.TRAVELPAYOUTS_API_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const parsed = (await response.json()) as TravelpayoutsResponse;
    if (!parsed.success || !parsed.data || parsed.data.length === 0) {
      return null;
    }

    const values = parsed.data.map((fare) => fare.value).filter((v) => Number.isFinite(v) && v > 0);
    if (values.length === 0) {
      return null;
    }

    return {
      average: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
      sampleWindowDays: REAL_SAMPLE_WINDOW_DAYS,
      observations: values.length,
    };
  } catch (error) {
    console.error(`[api] Erro ao consultar estatística de ${origin}->${destination}:`, error);
    return null;
  }
}

/**
 * Aeroportos brasileiros varridos pelo mapa de cobertura — os de maior
 * movimento, que é onde faz sentido o FlySpot existir. Constante, não
 * parâmetro de query: a pergunta que o mapa responde ("qual o tamanho
 * real do produto possível?") só tem sentido comparando sempre a mesma
 * base entre execuções. Ver _local-bdr-policy-016.
 */
export const COVERAGE_SWEEP_ORIGINS = [
  'GRU', 'CGH', 'VCP', 'GIG', 'SDU', 'BSB', 'CNF', 'POA', 'CWB', 'FLN',
  'SSA', 'REC', 'FOR', 'BEL', 'MAO', 'VIX', 'GYN', 'NAT', 'MCZ', 'SLZ',
];

/** Quantas origens são consultadas em paralelo na varredura de cobertura. */
const COVERAGE_SWEEP_CONCURRENCY = 4;

export interface CoverageByOrigin {
  origin: string;
  destinationCount: number;
  cheapest: { destination: string; price: number } | null;
  error?: string;
}

export interface CoverageMap {
  configured: boolean;
  origins: CoverageByOrigin[];
  /** Soma de pares origem→destino com preço real em cache — o número que decide o rumo do produto. */
  totalRoutes: number;
  /** Destinos distintos alcançáveis a partir de qualquer origem varrida. */
  uniqueDestinations: number;
  generatedAt: string;
}

/**
 * Varre todas as origens de `COVERAGE_SWEEP_ORIGINS` e conta quantas
 * rotas têm preço real em cache — responde de uma vez a pergunta que o
 * explorador de uma origem só (`listCachedDestinations`) respondia aos
 * pedaços. Ver _local-bdr-policy-016.
 *
 * Roda em lotes pequenos em vez de tudo em paralelo: são ~20 chamadas
 * externas e não vale a pena empurrar todas de uma vez contra um
 * parceiro cuja cota exata a gente não controla. Nunca lança — uma
 * origem que falha entra no mapa com `error` e as outras seguem, porque
 * um mapa parcial ainda informa a decisão; um erro total não informa
 * nada.
 */
export async function mapCoverage(): Promise<CoverageMap> {
  const generatedAt = new Date().toISOString();
  if (!env.TRAVELPAYOUTS_API_TOKEN) {
    return { configured: false, origins: [], totalRoutes: 0, uniqueDestinations: 0, generatedAt };
  }

  const origins: CoverageByOrigin[] = [];
  const allDestinations = new Set<string>();

  for (let i = 0; i < COVERAGE_SWEEP_ORIGINS.length; i += COVERAGE_SWEEP_CONCURRENCY) {
    const batch = COVERAGE_SWEEP_ORIGINS.slice(i, i + COVERAGE_SWEEP_CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (origin) => {
        const { destinations, error } = await listCachedDestinations(origin);
        // listCachedDestinations já devolve ordenado por preço, então o
        // primeiro item é o mais barato — não precisa reordenar aqui.
        const cheapest = destinations[0]
          ? { destination: destinations[0].destination, price: destinations[0].price }
          : null;
        const entry: CoverageByOrigin = {
          origin,
          destinationCount: destinations.length,
          cheapest,
          ...(error ? { error } : {}),
        };
        return { entry, destinations };
      })
    );
    settled.forEach(({ entry, destinations }) => {
      origins.push(entry);
      destinations.forEach((d) => allDestinations.add(d.destination));
    });
  }

  const totalRoutes = origins.reduce((sum, entry) => sum + entry.destinationCount, 0);

  return {
    configured: true,
    origins,
    totalRoutes,
    uniqueDestinations: allDestinations.size,
    generatedAt,
  };
}

/**
 * Testa uma rota origin->destination específica com a MESMA chamada que
 * `getCheapestRealFare` faz de verdade durante um scan, mas devolvendo o
 * porquê de um resultado vazio em vez de só `null` — pra depurar o caso
 * "apareceu no listCachedDestinations, mas o scan real ainda vem
 * simulado" (_local-bdr-policy-012). Nunca lança.
 */
export async function testRoute(
  origin: string,
  destination: string
): Promise<{ configured: boolean; httpStatus?: number; itemCount?: number; cheapest?: { price: number; gate: string }; error?: string }> {
  if (!env.TRAVELPAYOUTS_API_TOKEN) {
    return { configured: false };
  }
  try {
    const url = `https://api.travelpayouts.com/v2/prices/latest?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&currency=brl&token=${env.TRAVELPAYOUTS_API_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { configured: true, httpStatus: response.status, error: `HTTP ${response.status}` };
    }
    const parsed = (await response.json()) as TravelpayoutsResponse;
    if (!parsed.success) {
      return { configured: true, httpStatus: response.status, itemCount: 0, error: "Resposta com success: false" };
    }
    const items = parsed.data ?? [];
    if (items.length === 0) {
      return { configured: true, httpStatus: response.status, itemCount: 0 };
    }
    const cheapest = items.reduce((min, fare) => (fare.value < min.value ? fare : min), items[0]);
    return { configured: true, httpStatus: response.status, itemCount: items.length, cheapest: { price: cheapest.value, gate: cheapest.gate } };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : 'Erro de rede desconhecido' };
  }
}

/**
 * Chamada de teste pra diagnóstico (GET /api/admin/diagnostics) — usa a
 * mesma rota confirmada com cobertura real no spike (GRU→GIG), então um
 * `ok: false` aqui aponta pra token ausente/inválido/sem cota, não pra
 * "essa rota específica não tem dado". Nunca lança, mesmo padrão do
 * resto do cliente. Ver _local-bdr-policy-010.
 */
export async function testConnection(): Promise<{ configured: boolean; ok: boolean; httpStatus?: number; error?: string }> {
  if (!env.TRAVELPAYOUTS_API_TOKEN) {
    return { configured: false, ok: false };
  }
  try {
    const url = `https://api.travelpayouts.com/v2/prices/latest?origin=GRU&destination=GIG&currency=brl&token=${env.TRAVELPAYOUTS_API_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { configured: true, ok: false, httpStatus: response.status, error: `HTTP ${response.status}` };
    }
    const parsed = (await response.json()) as TravelpayoutsResponse;
    if (typeof parsed.success !== 'boolean') {
      return { configured: true, ok: false, httpStatus: response.status, error: 'Resposta em formato inesperado' };
    }
    return { configured: true, ok: true, httpStatus: response.status };
  } catch (error) {
    return { configured: true, ok: false, error: error instanceof Error ? error.message : 'Erro de rede desconhecido' };
  }
}
