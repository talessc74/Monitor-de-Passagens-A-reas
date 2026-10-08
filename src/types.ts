/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FlightMonitor as SharedFlightMonitor } from '../packages/types/src/index';

export * from '../packages/types/src/index';

// Frontend Vite descontinuado (apps/web é o atual) e não publicado. Os tipos de
// "sites" saíram de @mpa/types (ficção — ver _local-bdr-policy-017); ficam aqui
// só para este código legado continuar compilando até ser removido.
export type FlightMonitor = SharedFlightMonitor & { trackedSites: string[] };

export interface AirlineSite {
  id: string;
  name: string;
  url: string;
  logo: string;
  status: 'active' | 'maintenance';
  scrapedCount: number;
  lastScrapedAt: string | null;
  avgResponseMs: number;
}
