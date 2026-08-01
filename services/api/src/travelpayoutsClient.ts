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
