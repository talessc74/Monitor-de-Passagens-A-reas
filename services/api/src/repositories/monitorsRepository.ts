import type { FlightMonitor } from '@mpa/types';
import { db, COLLECTIONS } from '../firestore.js';

const collection = () => db.collection(COLLECTIONS.monitors);

/**
 * Monitores criados antes dos campos `infants`/`searchMode` existirem
 * não têm esses dados gravados no Firestore. Ver _local-adr-policy-001
 * (data): sem script de backfill, os campos ausentes são normalizados
 * na leitura — ausência de `searchMode` preserva o comportamento antigo
 * (`'dated'`).
 */
function normalizeMonitor(data: FlightMonitor): FlightMonitor {
  return {
    ...data,
    infants: data.infants ?? 0,
    searchMode: data.searchMode ?? 'dated',
  };
}

export async function listMonitorsForUser(userId: string): Promise<FlightMonitor[]> {
  const snapshot = await collection().where('userId', '==', userId).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => normalizeMonitor(doc.data() as FlightMonitor));
}

export async function getMonitor(id: string): Promise<FlightMonitor | null> {
  const doc = await collection().doc(id).get();
  return doc.exists ? normalizeMonitor(doc.data() as FlightMonitor) : null;
}

export async function createMonitor(monitor: FlightMonitor): Promise<FlightMonitor> {
  await collection().doc(monitor.id).set(monitor);
  return monitor;
}

/**
 * O patch aceita `FieldValue.delete()` além dos valores normais de
 * `FlightMonitor` — necessário para remover de fato campos de data ao
 * editar um monitor para o modo `anytime`. Ver _local-edr-policy-003.
 */
export async function updateMonitor(
  id: string,
  patch: Partial<Record<keyof FlightMonitor, unknown>>
): Promise<FlightMonitor | null> {
  const ref = collection().doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }
  await ref.set(patch, { merge: true });
  const updated = await ref.get();
  return normalizeMonitor(updated.data() as FlightMonitor);
}

export async function deleteMonitor(id: string): Promise<void> {
  await collection().doc(id).delete();
}

export async function deleteAllMonitorsForUser(userId: string): Promise<void> {
  const snapshot = await collection().where('userId', '==', userId).get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
