import type { FlightMonitor, ScanResult } from '@mpa/types';
import { getCheapestRealFare as getTravelpayoutsFare } from './travelpayoutsClient.js';
import { getCheapestRealFare as getSkyScrapperFare } from './skyScrapperClient.js';

interface FareSources {
  travelpayouts: (origin: string, destination: string) => Promise<ScanResult | null>;
  skyScrapper: (origin: string, destination: string, departureDate: string | null) => Promise<ScanResult | null>;
}

const defaultSources: FareSources = { travelpayouts: getTravelpayoutsFare, skyScrapper: getSkyScrapperFare };

/**
 * Monitor com data: o Sky Scrapper (busca ao vivo, para a data de ida) vem
 * primeiro; o Travelpayouts (cache de 2-7 dias, sem casar datas) fica de
 * reserva. Monitor sem data: só o Travelpayouts faz sentido, o Sky Scrapper
 * exige uma data. Ver _local-bdr-policy-019.
 */
export async function findRealFare(monitor: FlightMonitor, sources: FareSources = defaultSources): Promise<ScanResult | null> {
  const travelpayouts = () => sources.travelpayouts(monitor.origin, monitor.destination);
  const skyScrapper = () => sources.skyScrapper(monitor.origin, monitor.destination, monitor.departureDate ?? null);
  const inOrder = monitor.departureDate ? [skyScrapper, travelpayouts] : [travelpayouts, skyScrapper];

  for (const source of inOrder) {
    const fare = await source();
    if (fare && fare.price > 0) return fare;
  }
  return null;
}
