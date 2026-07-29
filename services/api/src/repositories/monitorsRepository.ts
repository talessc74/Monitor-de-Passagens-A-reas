import type { FlightMonitor } from '@mpa/types';
import { db, COLLECTIONS } from '../firestore.js';

const collection = () => db.collection(COLLECTIONS.monitors);

export async function listMonitorsForUser(userId: string): Promise<FlightMonitor[]> {
  const snapshot = await collection().where('userId', '==', userId).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => doc.data() as FlightMonitor);
}

export async function getMonitor(id: string): Promise<FlightMonitor | null> {
  const doc = await collection().doc(id).get();
  return doc.exists ? (doc.data() as FlightMonitor) : null;
}

export async function createMonitor(monitor: FlightMonitor): Promise<FlightMonitor> {
  await collection().doc(monitor.id).set(monitor);
  return monitor;
}

export async function updateMonitor(
  id: string,
  patch: Partial<FlightMonitor>
): Promise<FlightMonitor | null> {
  const ref = collection().doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }
  await ref.set(patch, { merge: true });
  const updated = await ref.get();
  return updated.data() as FlightMonitor;
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
