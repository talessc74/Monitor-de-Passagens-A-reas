/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FlightHistoryEntry {
  date: string;
  price: number;
  site: string;
}

export interface FlightMonitor {
  id: string;
  userId: string | null;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departureDate: string;
  departFlexDays?: number;
  returnDate: string;
  returnFlexDays?: number;
  adults: number;
  children: number;
  infants: number;
  targetPrice: number;
  currentPrice: number | null;
  bestPriceTracked: number | null;
  trackedSites: string[];
  notificationsEnabled: boolean;
  email: string;
  createdAt: string;
  lastScannedAt: string | null;
  nextScanAt: string | null;
  history: FlightHistoryEntry[];
  status: 'active' | 'paused';
}

export interface NotificationLog {
  id: string;
  userId: string | null;
  monitorId: string;
  origin: string;
  destination: string;
  title: string;
  message: string;
  price: number;
  targetPrice: number;
  sentTo: string;
  sentAt: string;
  type: 'price_update' | 'target_reached' | 'promotion';
  purchaseUrl?: string;
}

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

export interface ScanResult {
  site: string;
  price: number;
  durationHours: number;
  stops: number;
  isPromotion: boolean;
  details: string;
}

export interface ScanResponse {
  success: boolean;
  monitor: FlightMonitor;
  results: ScanResult[];
  generalAnalysis: string;
  cheapestResult: ScanResult;
  triggeredNotification: NotificationLog | null;
}

export interface RouteStats {
  average: number;
  min: number;
  max: number;
  sampleWindowDays: number;
  observations: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  plan: 'free' | 'pro';
  createdAt: string;
}
