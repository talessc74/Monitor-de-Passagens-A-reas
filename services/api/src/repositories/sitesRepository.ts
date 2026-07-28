import type { AirlineSite } from '@mpa/types';
import { db, COLLECTIONS } from '../firestore.js';

const collection = () => db.collection(COLLECTIONS.sites);

export async function listSites(): Promise<AirlineSite[]> {
  const snapshot = await collection().get();
  return snapshot.docs.map((doc) => doc.data() as AirlineSite);
}

export async function getSite(id: string): Promise<AirlineSite | null> {
  const doc = await collection().doc(id).get();
  return doc.exists ? (doc.data() as AirlineSite) : null;
}

export async function upsertSite(site: AirlineSite): Promise<void> {
  await collection().doc(site.id).set(site, { merge: true });
}

export async function patchSite(id: string, patch: Partial<AirlineSite>): Promise<void> {
  await collection().doc(id).set(patch, { merge: true });
}
