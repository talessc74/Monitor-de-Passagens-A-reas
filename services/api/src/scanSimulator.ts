import { Type } from '@google/genai';
import type { ScanResult } from '@mpa/types';
import { env } from './env.js';
import { getGeminiClient } from './geminiClient.js';

/**
 * Simulação de preços via Gemini (fallback offline se indisponível).
 * TEMPORÁRIO: esta é a Fase 1/2 do roadmap — a Fase 7 substitui esta
 * peça por buscas reais (Duffel/Amadeus) atrás da mesma assinatura,
 * sem tocar no resto do sistema. Ver _local-adr-policy-001 (application).
 */

interface ScanParams {
  originCity: string;
  origin: string;
  destinationCity: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  children: number;
  targetPrice: number;
  sitesToScan: string[];
}

interface ScanOutcome {
  results: ScanResult[];
  generalAnalysis: string;
}

function offlineSimulation(params: ScanParams, note: string): ScanOutcome {
  const results: ScanResult[] = params.sitesToScan.map((siteId) => {
    const basePrice = params.destination === 'LIS' ? 4500 : 2500;
    const randomCoeff = 0.85 + Math.random() * 0.3;
    const finalPrice = Math.round(basePrice * randomCoeff * (params.adults + params.children * 0.7));
    return {
      site: siteId,
      price: finalPrice,
      durationHours: params.destination === 'LIS' ? 10 : 7,
      stops: Math.random() > 0.4 ? 1 : 0,
      isPromotion: finalPrice < params.targetPrice,
      details: 'Voo simulado com saída noturna, ideal para maximizar o tempo no destino.',
    };
  });
  return { results, generalAnalysis: note };
}

export async function runScanSimulation(params: ScanParams): Promise<ScanOutcome> {
  const ai = getGeminiClient();
  if (!ai) {
    return offlineSimulation(
      params,
      'Simulação offline local ativada. O robô estimou as tarifas com base na distância entre aeroportos.'
    );
  }

  const prompt = `Você é um robô de busca inteligente de passagens aéreas. O usuário quer viajar de ${params.originCity} (${params.origin}) para ${params.destinationCity} (${params.destination}) saindo em ${params.departureDate} e retornando em ${params.returnDate} com ${params.adults} adultos e ${params.children} crianças.
Determine valores fictícios porém altamente realistas em Reais Brasileiros (BRL) para as seguintes companhias aéreas: [${params.sitesToScan.join(', ')}].
Considere a data atual das buscas correspondente ao ano de 2026. Escreva uma análise breve sobre as flutuações sazonais, proximidade da data, se o preço está bom e os detalhes fictícios para cada voo (escalas, duração, etc).
Sempre garanta que os preços gerados façam sentido para uma viagem dessa distância (ex: viagens internacionais custam mais que domésticas, classe econômica).`;

  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  site: { type: Type.STRING, description: 'Identificador do site (ex: latam, gol, azul, decolar)' },
                  price: { type: Type.NUMBER, description: 'Preço total para todos os passageiros em BRL' },
                  durationHours: { type: Type.NUMBER, description: 'Duração aproximada do voo em horas' },
                  stops: { type: Type.INTEGER, description: 'Número de paradas ou escalas' },
                  isPromotion: {
                    type: Type.BOOLEAN,
                    description: 'Se é um preço promocional em comparação com o preço médio habitual',
                  },
                  details: { type: Type.STRING, description: 'Horários prováveis ou operadoras de voos' },
                },
                required: ['site', 'price', 'durationHours', 'stops', 'isPromotion', 'details'],
              },
            },
            generalAnalysis: {
              type: Type.STRING,
              description: 'Uma análise curta em português (máximo 3 frases) do mercado e preços para este trecho e datas.',
            },
          },
          required: ['results', 'generalAnalysis'],
        },
      },
    });

    const dataText = response.text ? response.text.trim() : '';
    if (!dataText) {
      throw new Error('Resposta vazia do Gemini');
    }
    const parsed = JSON.parse(dataText);
    if (!parsed.results || parsed.results.length === 0) {
      throw new Error('Resultados de busca vazios');
    }
    return { results: parsed.results, generalAnalysis: parsed.generalAnalysis ?? '' };
  } catch (error) {
    console.error('Erro na chamada do Gemini API, caindo para simulação em código:', error);
    return offlineSimulation(
      params,
      'Preços simulados dinamicamente via gerador offline devido a limites de conexão de rede.'
    );
  }
}
