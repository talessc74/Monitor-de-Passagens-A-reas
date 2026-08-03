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

export async function updateUser(uid: string, patch: Partial<UserProfile>): Promise<void> {
  await collection().doc(uid).set(patch, { merge: true });
}

/**
 * Eventos de assinatura do Stripe (`customer.subscription.*`) trazem o
 * `customer` id, não o uid do Firebase — precisamos do caminho inverso
 * a partir do `stripeCustomerId` já gravado em `checkout.session.completed`.
 * Ver _local-adr-policy-003.
 */
export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<UserProfile | null> {
  const snapshot = await collection().where('stripeCustomerId', '==', stripeCustomerId).limit(1).get();
  return snapshot.empty ? null : (snapshot.docs[0].data() as UserProfile);
}

export async function deleteUser(uid: string): Promise<void> {
  await collection().doc(uid).delete();
}

/**
 * Usado só pela rota /api/admin (conceder/revogar isAdmin por e-mail) —
 * ver _local-adr-policy-002 (controls). `null` tanto se o e-mail não
 * existe quanto se ainda não fez login nenhuma vez (perfil só existe
 * a partir do primeiro /api/me via ensureUser).
 */
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const snapshot = await collection().where('email', '==', email).limit(1).get();
  return snapshot.empty ? null : (snapshot.docs[0].data() as UserProfile);
}
