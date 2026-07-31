import { randomUUID } from 'node:crypto';
import type { ItineraryMonitor, NotificationLog } from '@mpa/types';
import { updateItineraryMonitor } from './repositories/itineraryMonitorsRepository.js';
import { createNotification } from './repositories/notificationsRepository.js';
import { findCheapestItinerary, beatsBaselineByMargin } from './itinerarySearch.js';
import { getRouteStats } from './routeStats.js';

/**
 * Fase 9 ("Itinerários") — ver _local-bdr-plan-003. Lógica de execução de
 * um scan de itinerário, extraída para ser reaproveitada tanto pela rota
 * autenticada (POST /api/itineraries/:id/scan) quanto pela interna
 * (POST /internal/itinerary-scan/:id, chamada pelo scheduler do
 * services/generator) — mesmo padrão de executeScan.ts /
 * _local-adr-policy-002.
 *
 * Diferente de um FlightMonitor, não existe um único purchaseUrl aqui:
 * um itinerário multi-trecho é várias passagens separadas, de
 * companhias possivelmente diferentes — a notificação aponta para a
 * tela do itinerário no produto, não para um deep-link externo.
 */
export async function executeItineraryScan(monitor: ItineraryMonitor): Promise<ItineraryMonitor> {
  const [itinerary, baseline] = await Promise.all([
    findCheapestItinerary({
      origin: monitor.origin,
      finalDestination: monitor.finalDestination,
      maxLegs: monitor.maxLegs,
      maxLayoverHours: monitor.maxLayoverHours,
      allowOvernightLayovers: monitor.allowOvernightLayovers,
      adults: 1,
      children: 0,
      targetPrice: monitor.targetPrice,
    }),
    getRouteStats({
      origin: monitor.origin,
      destination: monitor.finalDestination,
      searchMode: 'anytime',
      adults: 1,
      children: 0,
      infants: 0,
    } as any),
  ]);

  const directBaselinePrice = baseline.average;
  const worthRecommending = itinerary ? beatsBaselineByMargin(itinerary.total, directBaselinePrice) : false;
  const currentBestTotal = worthRecommending && itinerary ? itinerary.total : null;

  const prevBestTotal = monitor.currentBestTotal;
  const history = [...monitor.history, { date: new Date().toISOString(), total: currentBestTotal ?? directBaselinePrice }];
  if (history.length > 20) history.shift();

  if (monitor.notificationsEnabled && currentBestTotal !== null) {
    const isUnderTarget = currentBestTotal <= monitor.targetPrice;
    const totalChanged = prevBestTotal !== null && currentBestTotal !== prevBestTotal;

    let notification: NotificationLog | null = null;
    if (isUnderTarget) {
      notification = {
        id: 'not-' + randomUUID().slice(0, 9),
        userId: monitor.userId,
        monitorId: monitor.id,
        origin: monitor.origin,
        destination: monitor.finalDestination,
        title: `Itinerário mais barato encontrado! ${monitor.origin} ➔ ${monitor.finalDestination} por R$ ${currentBestTotal}`,
        message: `Achamos uma combinação de ${itinerary!.legs.length} trecho(s) separado(s) totalizando R$ ${currentBestTotal}, abaixo da sua meta de R$ ${monitor.targetPrice}. Lembre-se: bilhetes separados não têm proteção de conexão entre si — confira os detalhes no FlySpot antes de comprar.`,
        price: currentBestTotal,
        targetPrice: monitor.targetPrice,
        sentTo: monitor.email,
        sentAt: new Date().toISOString(),
        type: 'target_reached',
      };
    } else if (totalChanged) {
      const diff = currentBestTotal - (prevBestTotal as number);
      const arrow = diff < 0 ? '⬇️ Redução de preço' : '⬆️ Aumento de preço';
      notification = {
        id: 'not-' + randomUUID().slice(0, 9),
        userId: monitor.userId,
        monitorId: monitor.id,
        origin: monitor.origin,
        destination: monitor.finalDestination,
        title: `${arrow} no itinerário ${monitor.origin} ➔ ${monitor.finalDestination}`,
        message: `O total do melhor itinerário multi-trecho mudou de R$ ${prevBestTotal} para R$ ${currentBestTotal}.`,
        price: currentBestTotal,
        targetPrice: monitor.targetPrice,
        sentTo: monitor.email,
        sentAt: new Date().toISOString(),
        type: 'price_update',
      };
    }

    if (notification) {
      await createNotification(notification);
      // NÃO cria outbox event ainda: services/publisher's outbox
      // consumer busca monitorId só em mpa_monitors (FlightMonitor),
      // não em mpa_itinerary_monitors — criar o pointer aqui geraria um
      // evento que o publisher nunca resolve. Envio de e-mail pra
      // notificação de itinerário é próxima etapa (estender o publisher
      // pra checar as duas coleções, ou usar um campo discriminador no
      // OutboxEvent). Notificação in-app (mpa_notifications) funciona
      // normalmente — só o e-mail que ainda não dispara.
    }
  }

  const updated = await updateItineraryMonitor(monitor.id, {
    lastScannedAt: new Date().toISOString(),
    directBaselinePrice,
    currentBestItinerary: worthRecommending && itinerary ? itinerary.legs : null,
    currentBestTotal,
    history,
  });

  return updated as ItineraryMonitor;
}
