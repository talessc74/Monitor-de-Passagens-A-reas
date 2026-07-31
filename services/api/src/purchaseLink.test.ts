import { describe, expect, it } from 'vitest';
import { generatePurchaseLink } from './purchaseLink.js';

describe('generatePurchaseLink', () => {
  it('builds a LATAM deep link with uppercased IATA codes', () => {
    const url = generatePurchaseLink('latam', 'gru', 'lis', '2026-10-12', '2026-10-26', 2, 1);
    expect(url).toContain('origem=GRU');
    expect(url).toContain('destino=LIS');
    expect(url).toContain('adultos=2');
    expect(url).toContain('criancas=1');
  });

  it('builds a GOL deep link', () => {
    const url = generatePurchaseLink('gol', 'GRU', 'GIG', '2026-10-12', '2026-10-26', 1, 0);
    expect(url).toContain('b2c.voegol.com.br');
    expect(url).toContain('origin=GRU');
  });

  it('builds an Azul deep link', () => {
    const url = generatePurchaseLink('azul', 'GRU', 'REC', undefined, undefined, 1, 0);
    expect(url).toContain('voeazul.com.br');
  });

  it('builds a Decolar deep link with dates in the path', () => {
    const url = generatePurchaseLink('decolar', 'GRU', 'LIS', '2026-10-12', '2026-10-26', 1, 0);
    expect(url).toContain('decolar.com/shop/flights/search/roundtrip/GRU/LIS/2026-10-12/2026-10-26/1/0/0');
  });

  it('falls back to a Skyscanner deep link for any other site id', () => {
    const url = generatePurchaseLink('skyscanner', 'GRU', 'LIS', '2026-10-12', '2026-10-26', 1, 0);
    expect(url).toContain('skyscanner.com.br');
    expect(url).toContain('adults=1');
  });

  it('falls back to default dates and origin/destination when missing', () => {
    const url = generatePurchaseLink('latam', '', '', undefined, undefined, 0, 0);
    expect(url).toContain('origem=GRU');
    expect(url).toContain('destino=LIS');
    expect(url).toContain('adultos=1');
  });
});
