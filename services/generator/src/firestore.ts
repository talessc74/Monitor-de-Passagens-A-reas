import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env.js';

/**
 * Mesmo projeto Firebase compartilhado (lista-ai-f2916) e mesmas
 * coleções com prefixo mpa_ que services/api. Ver CLAUDE.md.
 */
export const COLLECTIONS = {
  monitors: 'mpa_monitors',
  users: 'mpa_users',
  system: 'system',
} as const;

function initFirebase() {
  if (getApps().length > 0) {
    return;
  }

  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : applicationDefault();

  initializeApp({
    credential,
    projectId: env.FIREBASE_PROJECT_ID,
  });
}

initFirebase();

export const db = getFirestore();
