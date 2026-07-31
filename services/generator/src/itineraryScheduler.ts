import type { ItineraryMonitor } from '@mpa/types';
import { FieldValue } from 'firebase-admin/firestore';
import { db, COLLECTIONS } from './firestore.js';
import { env } from './env.js';
import { chunk } from './scheduler.js';

/**
 * Fase 9 ("Itinerários") — ver _local-bdr-plan-003. Loop de polling
 * paralelo ao de FlightMonitor (scheduler.ts), varrendo
 * mpa_itinerary_monitors vencidos e disparando o recompute via
 * services/api (/internal/itinerary-scan/:id). Mesmo padrão de lease
 * por transação e reagendamento, ver _local-adr-policy-002.
 *
 * Diferente do scheduler de FlightMonitor, não há lookup de plano por
 * usuário aqui: ItineraryMonitor só existe pra quem já é Pro no momento
 * da criação (routes/itineraries.ts), então usa direto
 * PRO_SCAN_INTERVAL_HOURS. Um downgrade de plano depois de criado não
 * pausa o itinerário automaticamente — isso é uma lacuna conhecida, não
 * resolvida nesta v1 (o pauseExcessMonitorsForUser existente cobre só
 * FlightMonitor).
 */

interface ItineraryTickStats {
  tickAt: string;
  due: number;
  scansAttempted: number;
  scansSucceeded: number;
  scansFailed: number;
  leaseSkipped: number;
}

async function acquireItineraryLease(itineraryId: string, now: number): Promise<boolean> {
  const ref = db.collection(COLLECTIONS.itineraryMonitors).doc(itineraryId);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return false;
    const data = doc.data() as ItineraryMonitor;
    if (data.status !== 'active') return false;
    if (data.scanningLockedUntil && new Date(data.scanningLockedUntil).getTime() > now) {
      return false;
    }
    tx.update(ref, { scanningLockedUntil: new Date(now + env.LEASE_DURATION_MS).toISOString() });
    return true;
  });
}

async function releaseItineraryLeaseAndReschedule(itinerary: ItineraryMonitor, succeeded: boolean) {
  const ref = db.collection(COLLECTIONS.itineraryMonitors).doc(itinerary.id);
  if (succeeded) {
    const nextScanAt = new Date(Date.now() + env.PRO_SCAN_INTERVAL_HOURS * 60 * 60 * 1000).toISOString();
    await ref.update({ scanningLockedUntil: FieldValue.delete(), nextScanAt });
  } else {
    await ref.update({ scanningLockedUntil: FieldValue.delete() });
  }
}

async function scanOneItinerary(itinerary: ItineraryMonitor): Promise<boolean> {
  try {
    const response = await fetch(`${env.API_INTERNAL_URL}/internal/itinerary-scan/${itinerary.id}`, {
      method: 'POST',
      headers: { 'X-Internal-Token': env.INTERNAL_SCAN_TOKEN },
    });
    return response.ok;
  } catch (error) {
    console.error(`[generator] falha ao chamar itinerary-scan interno para ${itinerary.id}:`, error);
    return false;
  }
}

export async function itineraryTick(): Promise<ItineraryTickStats> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const snapshot = await db
    .collection(COLLECTIONS.itineraryMonitors)
    .where('status', '==', 'active')
    .where('nextScanAt', '<=', nowIso)
    .get();

  const dueItineraries = snapshot.docs.map((doc) => doc.data() as ItineraryMonitor);

  const stats: ItineraryTickStats = {
    tickAt: nowIso,
    due: dueItineraries.length,
    scansAttempted: 0,
    scansSucceeded: 0,
    scansFailed: 0,
    leaseSkipped: 0,
  };

  for (const batch of chunk(dueItineraries, env.MAX_CONCURRENT_SCANS)) {
    await Promise.all(
      batch.map(async (itinerary) => {
        const leased = await acquireItineraryLease(itinerary.id, now);
        if (!leased) {
          stats.leaseSkipped += 1;
          return;
        }
        stats.scansAttempted += 1;
        const succeeded = await scanOneItinerary(itinerary);
        if (succeeded) stats.scansSucceeded += 1;
        else stats.scansFailed += 1;
        await releaseItineraryLeaseAndReschedule(itinerary, succeeded);
      })
    );
  }

  return stats;
}

let stopped = false;
let currentTimer: NodeJS.Timeout | null = null;

export function startItineraryScheduler() {
  async function loop() {
    if (stopped) return;
    try {
      const stats = await itineraryTick();
      if (stats.due > 0) {
        console.log(
          `[generator] itinerary tick: ${stats.due} vencidos, ${stats.scansAttempted} escaneados (${stats.scansSucceeded} ok, ${stats.scansFailed} falha), ${stats.leaseSkipped} com lease de outra instância`
        );
      }
    } catch (error) {
      console.error('[generator] erro no tick do itinerary scheduler:', error);
    }
    if (!stopped) {
      currentTimer = setTimeout(loop, env.POLL_INTERVAL_MS);
    }
  }
  loop();
}

export function stopItineraryScheduler() {
  stopped = true;
  if (currentTimer) clearTimeout(currentTimer);
}
