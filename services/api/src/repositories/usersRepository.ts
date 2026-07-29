import type { UserProfile } from '@mpa/types';
import { db, COLLECTIONS } from '../firestore.js';

const collection = () => db.collection(COLLECTIONS.users);

export async function getUser(uid: string): Promise<UserProfile | null> {
  const doc = await collection().doc(uid).get();
  return doc.exists ? (doc.data() as UserProfile) : null;
}

export async function ensureUser(uid: string, email: string | null, displayName: string | null): Promise<UserProfile> {
  const existing = await getUser(uid);
  if (existing) {
    return existing;
  }
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    plan: 'free',
    createdAt: new Date().toISOString(),
  };
  await collection().doc(uid).set(profile);
  return profile;
}

export async function deleteUser(uid: string): Promise<void> {
  await collection().doc(uid).delete();
}
