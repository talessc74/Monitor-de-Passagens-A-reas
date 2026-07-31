import { Type } from '@google/genai';
import { env } from './env.js';
import { getGeminiClient } from './geminiClient.js';

/**
 * Fase 9 ("Itinerários") — ver _local-bdr-plan-003. O Gemini aqui só
 * ENRIQUECE a lista de hubs candidatos que o Dijkstra depois testa —
 * ele não decide o itinerário nem participa da otimização de preço.
 * Mesmo padrão de separação de papéis do resto do sistema (Fase 7:
 * "Gemini recebe os preços reais e gera o texto de análise", nunca
 * escolhe preço/rota sozinho).
 */

const MAX_SUGGESTED_HUBS = 5;

async function offlineSuggestion(): Promise<string[]> {
  return [];
}

/**
 * Retorna até MAX_SUGGESTED_HUBS códigos IATA de hubs plausíveis para
 * conectar origin -> finalDestination, além dos curatedHubs já
 * cobertos (recebidos por parâmetro, não importados de
 * itinerarySearch.ts, pra evitar import circular entre os dois
 * módulos) — nunca remove ou substitui a lista curada, só complementa.
 * Sem GEMINI_API_KEY ou em qualquer falha, retorna lista vazia (o
 * grafo cai de volta para curatedHubs sozinho — nunca bloqueia a busca
 * por causa dessa sugestão).
 */
export async function suggestAdditionalHubs(
  origin: string,
  finalDestination: string,
  curatedHubs: readonly string[]
): Promise<string[]> {
  const ai = getGeminiClient();
  if (!ai) {
    return offlineSuggestion();
  }

  const known = new Set([...curatedHubs, origin, finalDestination]);
  const prompt = `Você é um especialista em roteiros aéreos criativos para reduzir custo total de viagem via bilhetes separados (não uma passagem única).
Rota: ${origin} -> ${finalDestination}.
Já consideramos estes hubs: ${curatedHubs.join(', ')}.
Sugira até ${MAX_SUGGESTED_HUBS} códigos IATA ADICIONAIS de aeroportos hub (não já listados) que poderiam, na prática, servir como escala intermediária mais barata nessa rota — considere malhas aéreas reais de baixo custo e hubs regionais menos óbvios.
Responda só com os códigos IATA plausíveis, sem repetir os já listados.`;

  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hubs: {
              type: Type.ARRAY,
              items: { type: Type.STRING, description: 'Código IATA de 3 letras' },
            },
          },
          required: ['hubs'],
        },
      },
    });

    const dataText = response.text ? response.text.trim() : '';
    if (!dataText) return offlineSuggestion();

    const parsed = JSON.parse(dataText) as { hubs?: unknown };
    if (!Array.isArray(parsed.hubs)) return offlineSuggestion();

    const cleaned = parsed.hubs
      .filter((h): h is string => typeof h === 'string')
      .map((h) => h.toUpperCase().trim())
      .filter((h) => /^[A-Z]{3}$/.test(h) && !known.has(h));

    return [...new Set(cleaned)].slice(0, MAX_SUGGESTED_HUBS);
  } catch (error) {
    console.error('Erro na chamada do Gemini para sugestão de hubs, ignorando enriquecimento:', error);
    return offlineSuggestion();
  }
}
