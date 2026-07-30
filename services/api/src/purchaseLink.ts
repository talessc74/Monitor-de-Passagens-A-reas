export function generatePurchaseLink(
  siteId: string,
  origin: string,
  destination: string,
  departureDate: string | undefined,
  returnDate: string | undefined,
  adults: number,
  children: number
): string {
  const o = (origin || 'GRU').toUpperCase().trim();
  const d = (destination || 'LIS').toUpperCase().trim();
  const depDate = departureDate || '2026-10-12';
  const retDate = returnDate || '2026-10-26';
  const ad = adults || 1;
  const ch = children || 0;

  if (siteId === 'latam') {
    return `https://www.latamairlines.com/br/pt/voos?origem=${o}&destino=${d}&saida=${depDate}&volta=${retDate}&adultos=${ad}&criancas=${ch}`;
  } else if (siteId === 'gol') {
    return `https://b2c.voegol.com.br/compra/busca-voos?origin=${o}&destination=${d}&outboundDate=${depDate}&inboundDate=${retDate}&adults=${ad}&children=${ch}`;
  } else if (siteId === 'azul') {
    return `https://www.voeazul.com.br/br/pt/home/selecao-voo?origin=${o}&destination=${d}&departureDate=${depDate}&returnDate=${retDate}&adults=${ad}&children=${ch}`;
  } else if (siteId === 'decolar') {
    return `https://www.decolar.com/shop/flights/search/roundtrip/${o}/${d}/${depDate}/${retDate}/${ad}/${ch}/0`;
  }

  const d1 = depDate.slice(2).replace(/-/g, '');
  const d2 = retDate.slice(2).replace(/-/g, '');
  return `https://www.skyscanner.com.br/transporte/passagens-aereas/${o.toLowerCase()}/${d.toLowerCase()}/${d1}/${d2}/?adults=${ad}&children=${ch}`;
}
