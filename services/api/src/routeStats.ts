import { Type } from '@google/genai';
import type { RouteStats } from '@mpa/types';
import { env } from './env.js';
import { getGeminiClient } from './geminiClient.js';
import type { PassengerDateInput } from './schemas/passengerDate.js';

/**
 * Estimativa de preço (média/mínima/máxima) para uma rota antes de o
 * monitor existir — consumida pelo cartão de histórico no onboarding.
 * Reaproveita o mesmo cliente Gemini do scanSimulator.ts, mas nunca
 * grava nada no Firestore. Ver _local-edr-policy-001.
 */

const SAMPLE_WINDOW_DAYS = 60;

function offlineRouteStats(params: PassengerDateInput): RouteStats {
  const basePrice = params.destination === 'LIS' ? 4500 : 2500;
  const passengerFactor = params.adults + params.children * 0.7 + params.infants * 0.1;
  const average = Math.round(basePrice * passengerFactor);
  return {
    average,
    min: Math.round(average * 0.82),
    max: Math.round(average * 1.2),
    sampleWindowDays: SAMPLE_WINDOW_DAYS,
    observations: 0,
  };
}

export async function getRouteStats(params: PassengerDateInput): Promise<RouteStats> {
  const ai = getGeminiClient();
  if (!ai) {
    return offlineRouteStats(params);
  }

  const dateClause =
    params.searchMode === 'dated'
      ? `com ida em ${params.departureDate}${
          params.departDaysBefore || params.departDaysAfter
            ? ` (aceita ${params.departDaysBefore ?? 0} dia(s) antes e ${params.departDaysAfter ?? 0} dia(s) depois)`
            : ''
        } e volta em ${params.returnDate}${
          params.returnDaysBefore || params.returnDaysAfter
            ? ` (aceita ${params.returnDaysBefore ?? 0} dia(s) antes e ${params.returnDaysAfter ?? 0} dia(s) depois)`
            : ''
        }`
      : params.earliestDeparture || params.latestReturn
      ? `sem data fixa, mas dentro de uma janela de viagem${
          params.earliestDeparture ? ` — a partir de ${params.earliestDeparture}` : ''
        }${params.latestReturn ? ` e de volta até ${params.latestReturn}` : ''}, priorizando o preço mais barato`
      : 'sem data fixa — o usuário aceita qualquer data futura, quer apenas o preço mais barato da rota';

  const prompt = `Você é um analista de preços de passagens aéreas. Para a rota ${params.origin} → ${params.destination}, ${dateClause}, para ${params.adults} adulto(s), ${params.children} criança(s) e ${params.infants} bebê(s), estime o preço total em Reais Brasileiros (BRL) observado nos últimos ${SAMPLE_WINDOW_DAYS} dias nesta rota: valor médio, mínimo e máximo. Considere a data atual das buscas correspondente ao ano de 2026. Garanta que os valores façam sentido para a distância da rota.`;

  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            average: { type: Type.NUMBER, description: 'Preço médio total em BRL' },
            min: { type: Type.NUMBER, description: 'Preço mínimo observado em BRL' },
            max: { type: Type.NUMBER, description: 'Preço máximo observado em BRL' },
            observations: { type: Type.INTEGER, description: 'Quantidade estimada de buscas/observações consideradas' },
          },
          required: ['average', 'min', 'max', 'observations'],
        },
      },
    });

    const dataText = response.text ? response.text.trim() : '';
    if (!dataText) {
      throw new Error('Resposta vazia do Gemini');
    }
    const parsed = JSON.parse(dataText);
    if (!parsed.average || !parsed.min || !parsed.max) {
      throw new Error('Estatísticas de rota vazias');
    }
    return {
      average: parsed.average,
      min: parsed.min,
      max: parsed.max,
      sampleWindowDays: SAMPLE_WINDOW_DAYS,
      observations: parsed.observations ?? 0,
    };
  } catch (error) {
    console.error('Erro na chamada do Gemini API para route-stats, caindo para simulação em código:', error);
    return offlineRouteStats(params);
  }
}
