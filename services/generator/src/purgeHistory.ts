import { PLAN_LIMITS } from '@mpa/types';
import type { FlightMonitor, UserProfile } from '@mpa/types';
import { db, COLLECTIONS } from './firestore.js';

/**
 * Expurgo diário do histórico de preços conforme o plano (7 dias
 * Free / 90 dias Pro) — não toca em NotificationLog nem mpa_outbox,
 * só em FlightMonitor.history. Ver _local-adr-policy-003.
 */
export async function purgeHistory(): Promise<{ monitorsChecked: number; monitorsTrimmed: number }> {
  const snapshot = await db.collection(COLLECTIONS.monitors).get();
  const monitors = snapshot.docs.map((doc) => doc.data() as FlightMonitor);

  let monitorsTrimmed = 0;

  for (const monitor of monitors) {
    const retentionDays = await retentionDaysFor(monitor.userId);
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const trimmed = monitor.history.filter((entry) => new Date(entry.date).getTime() >= cutoff);

    if (trimmed.length !== monitor.history.length) {
      await db.collection(COLLECTIONS.monitors).doc(monitor.id).update({ history: trimmed });
      monitorsTrimmed += 1;
    }
  }

  return { monitorsChecked: monitors.length, monitorsTrimmed };
}

async function retentionDaysFor(userId: string | null): Promise<number> {
  if (!userId) return PLAN_LIMITS.free.historyRetentionDays;
  const doc = await db.collection(COLLECTIONS.users).doc(userId).get();
  const profile = doc.data() as UserProfile | undefined;
  return PLAN_LIMITS[profile?.plan ?? 'free'].historyRetentionDays;
}
