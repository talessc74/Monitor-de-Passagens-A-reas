import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env.js';

/**
 * Projeto Firebase compartilhado com o produto Lista Aí (lista-ai-f2916).
 * Toda coleção deste produto usa o prefixo mpa_ para nunca colidir com
 * dados do outro produto. Ver CLAUDE.md.
 */
export const COLLECTIONS = {
  monitors: 'mpa_monitors',
  notifications: 'mpa_notifications',
  sites: 'mpa_sites',
  users: 'mpa_users',
  outbox: 'mpa_outbox',
  webhookEvents: 'mpa_webhook_events',
  itineraryMonitors: 'mpa_itinerary_monitors',
  waitlist: 'mpa_waitlist',
} as const;

function initFirebase() {
  if (getApps().length > 0) {
    return;
  }

  // Cloud Run injeta credenciais do serviço automaticamente (ADC).
  // Em desenvolvimento local, usa GOOGLE_APPLICATION_CREDENTIALS apontando
  // para um arquivo de service account, ou `gcloud auth application-default login`.
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
