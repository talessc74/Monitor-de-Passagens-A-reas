import { GoogleGenAI } from '@google/genai';
import { env } from './env.js';

/**
 * Fonte única do cliente Gemini — compartilhada entre scanSimulator.ts
 * (preço do scan) e routeStats.ts (estimativa de preço no onboarding),
 * para que ambos tenham o mesmo comportamento de fallback offline
 * quando GEMINI_API_KEY está ausente. Ver _local-edr-policy-001.
 */
let client: GoogleGenAI | null | undefined;

export function getGeminiClient(): GoogleGenAI | null {
  if (client === undefined) {
    client = env.GEMINI_API_KEY
      ? new GoogleGenAI({
          apiKey: env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        })
      : null;
  }
  return client;
}
