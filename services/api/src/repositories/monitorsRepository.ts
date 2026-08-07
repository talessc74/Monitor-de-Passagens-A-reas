import type { FlightMonitor } from '@mpa/types';
import { FieldValue } from 'firebase-admin/firestore';
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

/**
 * Apaga de TODOS os monitores os preços herdados do simulador, que
 * ficaram gravados no Firestore antes da _local-bdr-policy-016.
 *
 * Sem isso a amputação do simulador fica pela metade e piora o
 * problema: os números inventados continuariam na tela, agora sem o
 * selo "Simulado" que ao menos os identificava — passariam a se ler
 * como preço real. Como não há como distinguir, documento a documento,
 * o que veio de fonte real do que veio do simulador, a limpeza é total:
 * os monitores voltam ao estado "ainda não varrido" e o próximo scan
 * repovoa só com o que for apurado de verdade.
 *
 * A configuração do usuário (rota, datas, meta, notificações) não é
 * tocada — só o que era resultado observado.
 */
export async function purgeSimulatedPrices(): Promise<{ monitorsCleared: number }> {
  const snapshot = await collection().get();
  if (snapshot.empty) return { monitorsCleared: 0 };

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {
      currentPrice: null,
      bestPriceTracked: null,
      lastPriceFoundAt: null,
      history: [],
      lastScanResults: FieldValue.delete(),
      lastItineraryLegs: FieldValue.delete(),
      lastItinerarySearch: FieldValue.delete(),
    });
  });
  await batch.commit();

  return { monitorsCleared: snapshot.size };
}

/**
 * Downgrade de plano: pausa (nunca apaga) os monitores que excedem o
 * novo limite, mantendo ativos os mais antigos por `createdAt`. Função
 * pura e testável, separada do handler do webhook. Ver
 * _local-adr-policy-003.
 */
export function pauseExcessMonitors(monitors: FlightMonitor[], newLimit: number): FlightMonitor[] {
  const sorted = [...monitors].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return sorted.slice(newLimit).filter((m) => m.status === 'active');
}

export async function pauseExcessMonitorsForUser(userId: string, newLimit: number): Promise<void> {
  const monitors = await listMonitorsForUser(userId);
  const toPause = pauseExcessMonitors(monitors, newLimit);
  if (toPause.length === 0) return;

  const batch = db.batch();
  toPause.forEach((monitor) => {
    batch.set(collection().doc(monitor.id), { status: 'paused' }, { merge: true });
  });
  await batch.commit();
}
