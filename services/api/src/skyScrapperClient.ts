import type { ScanResult } from '@mpa/types';
import { env } from './env.js';

/**
 * Segunda fonte de preço real do FlySpot, complementar ao Travelpayouts
 * — ver _local-adr-policy-004 (application) e _local-bdr-plan-006. Sky
 * Scrapper (RapidAPI, `apiheya/sky-scrapper`): scraper não-oficial do
 * Skyscanner, sem API pública oficial por trás. Ao contrário do
 * Travelpayouts (cache de buscas de terceiros, estreito fora da ponte
 * SP-RJ), faz uma busca ao vivo — no spike, cobriu inclusive BSB, rota
 * que o Travelpayouts nunca retornou. Ver _local-bdr-plan-006 para os
 * dados brutos de teste e a ressalva jurídica (deferida a um disclaimer
 * futuro, não resolvida por este adapter).
 *
 * A API é assíncrona: a primeira chamada de busca frequentemente volta
 * com `context.status: "incomplete"` e zero itinerários enquanto o
 * scraping ainda roda do lado do provedor — não é "sem cobertura". Este
 * cliente tenta de novo (mesmos parâmetros) um número limitado de vezes
 * antes de desistir.
 */

const BASE_URL = 'https://sky-scrapper.p.rapidapi.com';
const RAPIDAPI_HOST = 'sky-scrapper.p.rapidapi.com';
const INCOMPLETE_RETRY_ATTEMPTS = 2;
const INCOMPLETE_RETRY_DELAY_MS = 3000;

function rapidApiHeaders(): Record<string, string> {
  return {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': env.RAPIDAPI_KEY as string,
  };
}

interface SkyScrapperAirportEntry {
  navigation: {
    relevantFlightParams: {
      skyId: string;
      entityId: string;
    };
  };
}

interface SkyScrapperAirportResponse {
  status: boolean;
  data: SkyScrapperAirportEntry[];
}

/**
 * Resolve um código IATA (ex: "GRU") para o par skyId/entityId que a
 * busca de voos exige — a API não aceita IATA puro. Cacheado em memória
 * por processo: os pares são estáveis (aeroportos não mudam de ID),
 * então não vale a pena repetir essa chamada extra a cada scan.
 */
const airportCache = new Map<string, { skyId: string; entityId: string } | null>();

async function resolveAirport(iataCode: string): Promise<{ skyId: string; entityId: string } | null> {
  if (airportCache.has(iataCode)) {
    return airportCache.get(iataCode) as { skyId: string; entityId: string } | null;
  }

  const url = `${BASE_URL}/api/v1/flights/searchAirport?query=${encodeURIComponent(iataCode)}`;
  const response = await fetch(url, { headers: rapidApiHeaders() });
  if (!response.ok) {
    airportCache.set(iataCode, null);
    return null;
  }

  const parsed = (await response.json()) as SkyScrapperAirportResponse;
  const match = parsed.data?.find((entry) => entry.navigation.relevantFlightParams.skyId === iataCode) ?? parsed.data?.[0];
  const resolved = match ? { skyId: match.navigation.relevantFlightParams.skyId, entityId: match.navigation.relevantFlightParams.entityId } : null;
  airportCache.set(iataCode, resolved);
  return resolved;
}

interface SkyScrapperItinerary {
  price: { raw: number };
  legs: Array<{
    durationInMinutes: number;
    stopCount: number;
    carriers: { marketing: Array<{ name: string }> };
  }>;
}

interface SkyScrapperSearchResponse {
  status: boolean;
  data: {
    context: { status: 'complete' | 'incomplete' };
    itineraries?: SkyScrapperItinerary[];
  };
}

async function searchFlightsOnce(params: {
  originSkyId: string;
  destinationSkyId: string;
  originEntityId: string;
  destinationEntityId: string;
  date: string;
}): Promise<SkyScrapperSearchResponse | null> {
  const query = new URLSearchParams({
    originSkyId: params.originSkyId,
    destinationSkyId: params.destinationSkyId,
    originEntityId: params.originEntityId,
    destinationEntityId: params.destinationEntityId,
    date: params.date,
    cabinClass: 'economy',
    adults: '1',
    sortBy: 'best',
    currency: 'BRL',
    market: 'pt-BR',
    countryCode: 'BR',
  });

  const response = await fetch(`${BASE_URL}/api/v2/flights/searchFlights?${query.toString()}`, { headers: rapidApiHeaders() });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SkyScrapperSearchResponse;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retorna a tarifa mais barata encontrada para origin->destination na
 * data informada, ou `null` se a fonte estiver desligada (sem chave),
 * sem cobertura, ou a resposta continuar "incomplete" após as
 * tentativas. Nunca lança: qualquer falha de rede/parse também vira
 * `null`, mesmo padrão de toda integração opcional deste projeto.
 */
export async function getCheapestRealFare(origin: string, destination: string, departureDate: string | null): Promise<ScanResult | null> {
  if (!env.RAPIDAPI_KEY || !departureDate) {
    return null;
  }

  try {
    const [originAirport, destinationAirport] = await Promise.all([resolveAirport(origin), resolveAirport(destination)]);
    if (!originAirport || !destinationAirport) {
      return null;
    }

    let result: SkyScrapperSearchResponse | null = null;
    for (let attempt = 0; attempt <= INCOMPLETE_RETRY_ATTEMPTS; attempt += 1) {
      result = await searchFlightsOnce({
        originSkyId: originAirport.skyId,
        destinationSkyId: destinationAirport.skyId,
        originEntityId: originAirport.entityId,
        destinationEntityId: destinationAirport.entityId,
        date: departureDate,
      });

      const itineraries = result?.data?.itineraries ?? [];
      if (itineraries.length > 0) {
        break;
      }
      if (result?.data?.context?.status !== 'incomplete' || attempt === INCOMPLETE_RETRY_ATTEMPTS) {
        break;
      }
      await sleep(INCOMPLETE_RETRY_DELAY_MS);
    }

    const itineraries = result?.data?.itineraries ?? [];
    if (itineraries.length === 0) {
      return null;
    }

    const cheapest = itineraries.reduce((min, it) => (it.price.raw < min.price.raw ? it : min), itineraries[0]);
    const leg = cheapest.legs[0];
    const carrierName = leg?.carriers.marketing[0]?.name ?? 'Sky Scrapper';

    return {
      site: carrierName,
      price: Math.round(cheapest.price.raw),
      durationHours: Math.round((leg?.durationInMinutes ?? 0) / 60),
      stops: leg?.stopCount ?? 0,
      isPromotion: false,
      details: `Preço real observado via Sky Scrapper (companhia: ${carrierName}).`,
    };
  } catch (error) {
    console.error(`[api] Erro ao consultar Sky Scrapper para ${origin}->${destination}:`, error);
    return null;
  }
}

/**
 * Chamada de teste pra diagnóstico (GET /api/admin/diagnostics) — só
 * resolve o aeroporto GRU (searchAirport), sem rodar uma busca de voo
 * completa, pra gastar o mínimo de cota possível. `ok: false` aqui
 * aponta pra key ausente/inválida/sem cota, não pra "sem cobertura
 * nesta rota". Nunca lança, mesmo padrão do resto do cliente. Ver
 * _local-bdr-policy-010.
 */
export async function testConnection(): Promise<{ configured: boolean; ok: boolean; httpStatus?: number; error?: string }> {
  if (!env.RAPIDAPI_KEY) {
    return { configured: false, ok: false };
  }
  try {
    const url = `${BASE_URL}/api/v1/flights/searchAirport?query=GRU`;
    const response = await fetch(url, { headers: rapidApiHeaders() });
    if (!response.ok) {
      return { configured: true, ok: false, httpStatus: response.status, error: `HTTP ${response.status}` };
    }
    const parsed = (await response.json()) as SkyScrapperAirportResponse;
    if (!parsed.data || parsed.data.length === 0) {
      return { configured: true, ok: false, httpStatus: response.status, error: 'Resposta sem dados de aeroporto' };
    }
    return { configured: true, ok: true, httpStatus: response.status };
  } catch (error) {
    return { configured: true, ok: false, error: error instanceof Error ? error.message : 'Erro de rede desconhecido' };
  }
}
