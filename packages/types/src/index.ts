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
  /**
   * 'dated' (padrão): datas obrigatórias abaixo. 'anytime': sem data
   * fixa — aceita opcionalmente uma janela de viagem via
   * `earliestDeparture`/`latestReturn` (ambos ausentes = sem restrição
   * nenhuma, preço solto). Ver _local-bdr-policy-006.
   */
  searchMode: 'dated' | 'anytime';
  departureDate?: string;
  departDaysBefore?: number;
  departDaysAfter?: number;
  returnDate?: string;
  returnDaysBefore?: number;
  returnDaysAfter?: number;
  /** Só usados quando searchMode === 'anytime'. Data mais cedo aceitável para embarcar. */
  earliestDeparture?: string;
  /** Só usados quando searchMode === 'anytime'. Data mais tarde aceitável para já estar de volta. */
  latestReturn?: string;
  adults: number;
  children: number;
  infants: number;
  targetPrice: number;
  /** Percentual acima do targetPrice que ainda dispara um aviso ('price_in_range'). 0 = só na meta exata. Ver _local-bdr-policy-005. */
  targetPriceMarginPercent: number;
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
  /**
   * Escolha do usuário entre as frequências permitidas pelo plano (ver
   * `SCAN_INTERVAL_OPTIONS`) — ausente = usa `DEFAULT_SCAN_INTERVAL_HOURS`
   * (6h, inclusive para Pro). Free nunca escolhe de fato: o scheduler
   * ignora este campo pra contas não-Pro/não-admin. Ver _local-bdr-policy-007.
   */
  scanIntervalHours?: number;
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
  type: 'price_update' | 'target_reached' | 'promotion' | 'price_in_range';
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
  /** Fase 1-6: id de site simulado (latam/gol/azul/decolar). Fase 7: código IATA da companhia aérea (LA/G3/AD) — Duffel/Amadeus retornam por companhia, não por site de venda. Quando `estimated: false`, carrega o nome da agência ("gate") retornada pelo Travelpayouts (ex: "Trip.com") — ver _local-adr-policy-004 (application). Ver ROADMAP.md Fase 7. */
  site: string;
  price: number;
  durationHours: number;
  stops: number;
  isPromotion: boolean;
  details: string;
  /** false = preço real (Travelpayouts Data API); true = simulado via Gemini. Ver _local-adr-policy-004 (application) — nunca misturar as duas etiquetas. */
  estimated: boolean;
}

/**
 * Parâmetros de busca de voo, comuns a qualquer fonte (simulador Gemini
 * hoje; Duffel/Amadeus na Fase 7) — mesma assinatura, fonte trocável
 * por trás. Ver _local-adr-policy-001 (application).
 */
export interface SearchParams {
  origin: string;
  destination: string;
  /** Ausentes quando a busca é 'anytime' — sem data específica. */
  departureDate?: string;
  returnDate?: string;
  /** Só usados quando a busca é 'anytime' — janela opcional de viagem. */
  earliestDeparture?: string;
  latestReturn?: string;
  adults: number;
  children: number;
  infants: number;
}

export interface FlightResult {
  /** Código IATA da companhia operadora/marketing (ex: LA, G3, AD). */
  carrier: string;
  price: number;
  currency: string;
  durationHours: number;
  stops: number;
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
  type: 'target_reached' | 'price_update' | 'price_in_range';
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
  /** IDs opacos do Stripe — nenhum dado de pagamento é replicado aqui. Ver _local-adr-policy-003. */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /**
   * Acesso total concedido manualmente (dev/beta-tester), independente do
   * plano pago — ver _local-adr-policy-002 (controls). Ortogonal a `plan`
   * de propósito: o webhook do Stripe só escreve `plan`/`stripeSubscriptionId`
   * (merge), então uma mudança de assinatura nunca apaga isto sem querer.
   */
  isAdmin?: boolean;
}

export interface PlanLimits {
  maxMonitors: number;
  /** Intervalo mais rápido disponível no plano — teto de velocidade, não o padrão de fato usado (ver `SCAN_INTERVAL_OPTIONS`/`scanIntervalHours` em `FlightMonitor`). */
  scanIntervalHours: number;
  historyRetentionDays: number;
}

/** Tabela de planos confirmada pelo dono do produto na Fase 6. Ver _local-adr-policy-003. */
export const PLAN_LIMITS: Record<UserProfile['plan'], PlanLimits> = {
  free: { maxMonitors: 2, scanIntervalHours: 6, historyRetentionDays: 7 },
  pro: { maxMonitors: 10, scanIntervalHours: 1, historyRetentionDays: 90 },
};

/** Teto generoso, não infinito de verdade — evita loop/consulta patológica caso algo itere sobre o limite. */
const ADMIN_LIMITS: PlanLimits = { maxMonitors: 9999, scanIntervalHours: PLAN_LIMITS.pro.scanIntervalHours, historyRetentionDays: 3650 };

/**
 * Frequências de varredura que cada plano pode escolher por monitor —
 * ver _local-bdr-policy-007. Free não escolhe (sempre 6h). Pro escolhe
 * entre 6h (padrão) e 1h; admin herda o mesmo leque do Pro.
 */
export const SCAN_INTERVAL_OPTIONS: Record<UserProfile['plan'], number[]> = {
  free: [6],
  pro: [6, 1],
};

/** Padrão de fato aplicado quando o usuário não escolhe nada — 6h para todos, inclusive Pro. */
export const DEFAULT_SCAN_INTERVAL_HOURS = 6;

export function allowedScanIntervals(profile: Pick<UserProfile, 'plan' | 'isAdmin'> | null | undefined): number[] {
  if (profile?.isAdmin) return SCAN_INTERVAL_OPTIONS.pro;
  return SCAN_INTERVAL_OPTIONS[profile?.plan ?? 'free'];
}

/**
 * Ponto único de resolução de limites — todo lugar que hoje faz
 * `PLAN_LIMITS[profile.plan]` deve usar isto no lugar, pra `isAdmin`
 * nunca ser esquecido em um novo enforcement point. Ver
 * _local-adr-policy-002 (controls).
 */
export function effectiveLimits(profile: Pick<UserProfile, 'plan' | 'isAdmin'> | null | undefined): PlanLimits {
  if (profile?.isAdmin) return ADMIN_LIMITS;
  return PLAN_LIMITS[profile?.plan ?? 'free'];
}

/**
 * Fase 9 ("Itinerários") — ver _local-bdr-plan-003. Um trecho comprado
 * separadamente dentro de um itinerário multi-trecho, distinto de um
 * ScanResult (que é uma cotação, não um bilhete escolhido).
 */
export interface ItineraryLeg {
  origin: string;
  destination: string;
  carrier: string;
  departureDate: string;
  price: number;
  /** Ausente no último trecho. Presença de pernoite indicada por layoverAfterHours >= overnight threshold do caller, não um campo separado. */
  layoverAfterHours?: number;
}

export interface ItineraryMonitor {
  id: string;
  userId: string;
  origin: string;
  finalDestination: string;
  /** Teto de trechos separados no itinerário — v1 recomenda 4, ver _local-bdr-plan-003. */
  maxLegs: number;
  /** Teto de conexão no mesmo dia; pernoite (allowOvernightLayovers) é a via para exceder isso entre trechos. */
  maxLayoverHours: number;
  allowOvernightLayovers: boolean;
  dateWindowStart: string;
  dateWindowEnd: string;
  targetPrice: number;
  currentBestItinerary: ItineraryLeg[] | null;
  currentBestTotal: number | null;
  /** Preço da passagem direta equivalente, usado como baseline de comparação — ver critério de margem mínima em _local-bdr-plan-003. */
  directBaselinePrice: number | null;
  history: Array<{ date: string; total: number }>;
  notificationsEnabled: boolean;
  email: string;
  createdAt: string;
  lastScannedAt: string | null;
  nextScanAt: string | null;
  status: 'active' | 'paused';
  scanningLockedUntil?: string;
}

/**
 * Landing de espera (pré-lançamento) — ver _local-adr-policy-004 (platform).
 * Isolado do restante do produto: sem userId, sem relação com FlightMonitor,
 * só um pointer de e-mail interessado antes do motor de busca real existir.
 */
export interface WaitlistSignup {
  id: string;
  email: string;
  createdAt: string;
}

export * from './airports';
