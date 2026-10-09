import { describe, expect, it, vi } from 'vitest';
import type { FlightMonitor, ScanResult } from '@mpa/types';
import { findRealFare } from './realFare.js';

const fare = (site: string, price: number): ScanResult => ({ site, price, durationHours: 1, stops: 0, isPromotion: false, details: 'x' });
const monitor = (departureDate?: string) => ({ origin: 'BSB', destination: 'JFK', departureDate }) as FlightMonitor;

describe('findRealFare', () => {
  it('monitor com data: usa o Sky Scrapper (ao vivo) e nem consulta o cache', async () => {
    const travelpayouts = vi.fn();
    const skyScrapper = vi.fn().mockResolvedValue(fare('Copa', 4300));
    const result = await findRealFare(monitor('2026-10-12'), { travelpayouts, skyScrapper });
    expect(result?.site).toBe('Copa');
    expect(skyScrapper).toHaveBeenCalledWith('BSB', 'JFK', '2026-10-12');
    expect(travelpayouts).not.toHaveBeenCalled();
  });

  it('monitor com data: cai no Travelpayouts quando o Sky Scrapper não acha preço', async () => {
    const travelpayouts = vi.fn().mockResolvedValue(fare('Trip.com', 4195));
    const skyScrapper = vi.fn().mockResolvedValue(null);
    const result = await findRealFare(monitor('2026-10-12'), { travelpayouts, skyScrapper });
    expect(result?.site).toBe('Trip.com');
  });

  it('monitor sem data: usa o Travelpayouts e não chama o Sky Scrapper se houver preço', async () => {
    const travelpayouts = vi.fn().mockResolvedValue(fare('Trip.com', 4195));
    const skyScrapper = vi.fn();
    const result = await findRealFare(monitor(undefined), { travelpayouts, skyScrapper });
    expect(result?.site).toBe('Trip.com');
    expect(skyScrapper).not.toHaveBeenCalled();
  });

  it('preço zero conta como sem preço e passa para a próxima fonte', async () => {
    const travelpayouts = vi.fn().mockResolvedValue(fare('Trip.com', 4195));
    const skyScrapper = vi.fn().mockResolvedValue(fare('Copa', 0));
    const result = await findRealFare(monitor('2026-10-12'), { travelpayouts, skyScrapper });
    expect(result?.site).toBe('Trip.com');
  });

  it('nenhuma fonte com preço: devolve null, sem inventar', async () => {
    const result = await findRealFare(monitor('2026-10-12'), {
      travelpayouts: vi.fn().mockResolvedValue(null),
      skyScrapper: vi.fn().mockResolvedValue(null),
    });
    expect(result).toBeNull();
  });
});
