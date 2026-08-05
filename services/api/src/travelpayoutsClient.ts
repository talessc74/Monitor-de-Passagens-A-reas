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
      estimated: false,
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
