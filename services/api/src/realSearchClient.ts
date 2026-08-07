import { env } from './env.js';

/**
 * Cliente pro services/scraper — busca de preço real sob demanda via
 * navegador de verdade (Playwright), acionada por um clique do usuário,
 * nunca pelo loop automático de scan. Ver _local-bdr-policy-015.
 */

export interface RealSearchRequest {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
}

export interface RealSearchResponse {
  success: boolean;
  price: number | null;
  currency: 'BRL';
  searchUrl: string;
  pageTitle?: string;
  error?: string;
  screenshotBase64?: string;
}

export async function requestRealSearch(params: RealSearchRequest): Promise<RealSearchResponse> {
  if (!env.SCRAPER_INTERNAL_URL || !env.INTERNAL_SCAN_TOKEN) {
    throw Object.assign(new Error('Busca de preço real não está configurada neste ambiente'), { code: 'NOT_CONFIGURED' });
  }

  const response = await fetch(`${env.SCRAPER_INTERNAL_URL}/internal/real-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': env.INTERNAL_SCAN_TOKEN,
    },
    body: JSON.stringify(params),
    // O scrape em si já tem teto próprio (SCRAPE_TIMEOUT_MS no
    // scraper); este é só um teto de rede pra não travar a requisição
    // do usuário indefinidamente se o serviço scraper cair.
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body as { error?: string } | null)?.error || `Serviço de busca real respondeu ${response.status}`);
  }

  return (await response.json()) as RealSearchResponse;
}
