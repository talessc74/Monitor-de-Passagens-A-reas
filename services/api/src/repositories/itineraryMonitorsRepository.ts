import type { ItineraryMonitor } from '@mpa/types';
import { db, COLLECTIONS } from '../firestore.js';

const collection = () => db.collection(COLLECTIONS.itineraryMonitors);

export async function listItineraryMonitorsForUser(userId: string): Promise<ItineraryMonitor[]> {
  const snapshot = await collection().where('userId', '==', userId).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => doc.data() as ItineraryMonitor);
}

export async function getItineraryMonitor(id: string): Promise<ItineraryMonitor | null> {
  const doc = await collection().doc(id).get();
  return doc.exists ? (doc.data() as ItineraryMonitor) : null;
}

export async function createItineraryMonitor(monitor: ItineraryMonitor): Promise<ItineraryMonitor> {
  await collection().doc(monitor.id).set(monitor);
  return monitor;
}

export async function updateItineraryMonitor(
  id: string,
  patch: Partial<Record<keyof ItineraryMonitor, unknown>>
): Promise<ItineraryMonitor | null> {
  const ref = collection().doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }
  await ref.set(patch, { merge: true });
  const updated = await ref.get();
  return updated.data() as ItineraryMonitor;
}

export async function deleteItineraryMonitor(id: string): Promise<void> {
  await collection().doc(id).delete();
}

export async function deleteAllItineraryMonitorsForUser(userId: string): Promise<void> {
  const snapshot = await collection().where('userId', '==', userId).get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
