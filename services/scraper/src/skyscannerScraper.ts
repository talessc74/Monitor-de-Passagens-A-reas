import { chromium } from 'playwright';
import { env } from './env.js';

/**
 * Busca sob demanda de preço real via navegador de verdade (Playwright)
 * — decisão do dono do produto de recuar da automação 24/7 (que
 * derrubaria em bloqueio de bot como qualquer scraper) para um clique
 * manual por vez, mesmo padrão de comportamento de uma pessoa comprando
 * passagem. Ver _local-bdr-policy-015.
 *
 * v1: só Skyscanner (agrega várias companhias numa busca só, maior
 * chance de achar algum preço mesmo se a estrutura da página mudar).
 * A extração de preço usa duas estratégias em cascata — seletor
 * conhecido primeiro, texto bruto da página como fallback — porque
 * este código nunca foi testado contra o site de verdade (rede deste
 * ambiente de desenvolvimento não alcança skyscanner.com.br); o
 * primeiro teste real acontece em produção, quando alguém clicar
 * "Buscar preço real agora".
 */

export interface RealSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
}

export interface RealSearchResult {
  success: boolean;
  price: number | null;
  currency: 'BRL';
  searchUrl: string;
  pageTitle?: string;
  error?: string;
  /** Só preenchido quando a extração falha — ajuda a ajustar o seletor sem precisar reproduzir localmente. */
  screenshotBase64?: string;
}

function buildSearchUrl(params: RealSearchParams): string {
  const o = params.origin.toLowerCase();
  const d = params.destination.toLowerCase();
  const d1 = params.departureDate.replace(/-/g, '').slice(2);
  const d2 = (params.returnDate ?? params.departureDate).replace(/-/g, '').slice(2);
  const query = new URLSearchParams({
    adults: String(params.adults),
    children: String(params.children),
  });
  return `https://www.skyscanner.com.br/transporte/passagens-aereas/${o}/${d}/${d1}/${d2}/?${query.toString()}`;
}

/**
 * Extrai o menor valor plausível em BRL do texto renderizado da
 * página — mais resistente a mudança de nome de classe/atributo do que
 * um seletor CSS fixo, ao custo de precisão (pode pegar um número que
 * não é preço de voo). Filtra a faixa óbvia de passagem doméstica/
 * internacional (R$ 100 a R$ 50.000) pra reduzir falso positivo.
 */
function extractCheapestPrice(pageText: string): number | null {
  const matches = [...pageText.matchAll(/R\$\s?([\d.,]+)/g)];
  const values = matches
    .map((m) => Number(m[1].replace(/\./g, '').replace(',', '.')))
    .filter((v) => Number.isFinite(v) && v >= 100 && v <= 50_000);
  if (values.length === 0) return null;
  return Math.min(...values);
}

export async function searchRealPrice(params: RealSearchParams): Promise<RealSearchResult> {
  const searchUrl = buildSearchUrl(params);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'pt-BR',
    });
    page.setDefaultTimeout(env.SCRAPE_TIMEOUT_MS);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: env.SCRAPE_TIMEOUT_MS });

    // Resultados carregam progressivamente (SPA) — espera um pouco de
    // rede ociosa antes de ler o texto, sem travar pra sempre se a
    // página nunca "quietar" de vez (timeout curto e tolerante a falha).
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);

    const pageTitle = await page.title();
    const pageText = await page.innerText('body').catch(() => '');
    const price = extractCheapestPrice(pageText);

    if (price === null) {
      const screenshotBuffer = await page.screenshot({ fullPage: false }).catch(() => null);
      return {
        success: false,
        price: null,
        currency: 'BRL',
        searchUrl,
        pageTitle,
        error: 'Página carregou mas não encontramos nenhum preço reconhecível no texto — pode precisar ajustar o extrator.',
        screenshotBase64: screenshotBuffer ? screenshotBuffer.toString('base64') : undefined,
      };
    }

    return { success: true, price, currency: 'BRL', searchUrl, pageTitle };
  } catch (error) {
    return {
      success: false,
      price: null,
      currency: 'BRL',
      searchUrl,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao abrir o navegador',
    };
  } finally {
    await browser.close();
  }
}
