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
  /** 'dated' (padrão): datas obrigatórias abaixo. 'anytime': nenhuma data é usada. */
  searchMode: 'dated' | 'anytime';
  departureDate?: string;
  departDaysBefore?: number;
  departDaysAfter?: number;
  returnDate?: string;
  returnDaysBefore?: number;
  returnDaysAfter?: number;
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
  /** Lease do scheduler (services/generator) — evita scan duplicado entre instâncias. */
  scanningLockedUntil?: string;
  /** Resultado por site do último scan — usado na tela de histórico do monitor. */
  lastScanResults?: ScanResult[];
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

/**
 * Evento de e-mail a enviar — ponteiro fino para um NotificationLog já
 * criado, consumido por services/publisher. Ver _local-adr-policy-002
 * (application). O id do documento É a chave de dedup/throttle
 * (monitorId:type:janela), garantindo idempotência via Firestore
 * .create() em vez de leitura-depois-escrita.
 */
export interface OutboxEvent {
  id: string;
  type: 'target_reached' | 'price_update';
  monitorId: string;
  userId: string | null;
  notificationId: string;
  /** 'sending' é um lease curto — evita o listener e o poll de segurança processarem o mesmo evento em paralelo. */
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  createdAt: string;
  sentAt?: string;
  lastError?: string;
  /** Quando o lease 'sending' foi tomado — permite reclamar leases travados (processo caiu no meio do envio). */
  sendingSince?: string;
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
