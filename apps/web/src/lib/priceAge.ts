export function formatPriceAge(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const elapsedMs = now - Date.parse(iso);
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return null;
  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 1) return 'há menos de 1 hora';
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

export const PRICE_BASIS_HINT = 'Menor preço encontrado para a rota — pode não valer para as suas datas exatas.';
