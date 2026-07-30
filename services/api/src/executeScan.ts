import { randomUUID } from 'node:crypto';
import type { FlightMonitor, NotificationLog, ScanResponse } from '@mpa/types';
import { updateMonitor } from './repositories/monitorsRepository.js';
import { createNotification } from './repositories/notificationsRepository.js';
import { createOutboxEvent } from './repositories/outboxRepository.js';
import { db, COLLECTIONS } from './firestore.js';
import { FieldValue } from 'firebase-admin/firestore';
import { runScanSimulation } from './scanSimulator.js';
import { generatePurchaseLink } from './purchaseLink.js';

/**
 * Lógica de execução de um scan — extraída para ser reaproveitada tanto
 * pela rota autenticada (POST /api/monitors/:id/scan, "Varrer Agora")
 * quanto pela rota interna (POST /internal/scan/:id, chamada pelo loop
 * de polling do services/generator). Ver _local-adr-policy-002.
 */
export async function executeScanForMonitor(monitor: FlightMonitor): Promise<ScanResponse> {
  const sitesToScan = monitor.trackedSites.length > 0 ? monitor.trackedSites : ['latam', 'gol', 'azul', 'decolar'];

  const { results, generalAnalysis } = await runScanSimulation({
    originCity: monitor.originCity,
    origin: monitor.origin,
    destinationCity: monitor.destinationCity,
    destination: monitor.destination,
    departureDate: monitor.departureDate,
    returnDate: monitor.returnDate,
    adults: monitor.adults,
    children: monitor.children,
    targetPrice: monitor.targetPrice,
    sitesToScan,
  });

  const validResults = results.filter((r) => r.price > 0);
  const sorted = [...validResults].sort((a, b) => a.price - b.price);
  const cheapestResult = sorted[0];

  if (!cheapestResult) {
    throw new Error('Resultados de busca vazios');
  }

  const prevPrice = monitor.currentPrice;
  const bestPriceTracked =
    !monitor.bestPriceTracked || cheapestResult.price < monitor.bestPriceTracked ? cheapestResult.price : monitor.bestPriceTracked;

  const history = [...monitor.history, { date: new Date().toISOString(), price: cheapestResult.price, site: cheapestResult.site }];
  if (history.length > 20) {
    history.shift();
  }

  const travelDatesText =
    monitor.searchMode === 'dated' && monitor.departureDate && monitor.returnDate
      ? `${monitor.departureDate} a ${monitor.returnDate}`
      : 'qualquer data (monitor sem data fixa)';

  let triggeredNotification: NotificationLog | null = null;
  const isUnderTarget = cheapestResult.price <= monitor.targetPrice;
  const marginCeiling = monitor.targetPrice * (1 + monitor.targetPriceMarginPercent / 100);
  const isInMarginRange = !isUnderTarget && cheapestResult.price <= marginCeiling;
  const priceChanged = prevPrice !== null && cheapestResult.price !== prevPrice;

  if (monitor.notificationsEnabled) {
    if (isUnderTarget) {
      triggeredNotification = {
        id: 'not-' + randomUUID().slice(0, 9),
        userId: monitor.userId,
        monitorId: monitor.id,
        origin: monitor.origin,
        destination: monitor.destination,
        title: `Meta Atingida! ${monitor.originCity} ➔ ${monitor.destinationCity} por R$ ${cheapestResult.price}`,
        message: `O site de passagens ${cheapestResult.site.toUpperCase()} atingiu um valor incrível de R$ ${cheapestResult.price} para as datas de sua viagem (${travelDatesText}). Este valor está abaixo da sua meta estipulada de R$ ${monitor.targetPrice}!`,
        price: cheapestResult.price,
        targetPrice: monitor.targetPrice,
        sentTo: monitor.email,
        sentAt: new Date().toISOString(),
        type: 'target_reached',
        purchaseUrl: generatePurchaseLink(
          cheapestResult.site,
          monitor.origin,
          monitor.destination,
          monitor.departureDate,
          monitor.returnDate,
          monitor.adults,
          monitor.children
        ),
      };
    } else if (isInMarginRange) {
      triggeredNotification = {
        id: 'not-' + randomUUID().slice(0, 9),
        userId: monitor.userId,
        monitorId: monitor.id,
        origin: monitor.origin,
        destination: monitor.destination,
        title: `Preço na faixa de aviso! ${monitor.originCity} ➔ ${monitor.destinationCity} por R$ ${cheapestResult.price}`,
        message: `O site de passagens ${cheapestResult.site.toUpperCase()} está oferecendo R$ ${cheapestResult.price} para as datas de sua viagem (${travelDatesText}). Está acima da sua meta de R$ ${monitor.targetPrice}, mas dentro da faixa de aviso de ${monitor.targetPriceMarginPercent}% que você definiu (até R$ ${marginCeiling.toFixed(2)}).`,
        price: cheapestResult.price,
        targetPrice: monitor.targetPrice,
        sentTo: monitor.email,
        sentAt: new Date().toISOString(),
        type: 'price_in_range',
        purchaseUrl: generatePurchaseLink(
          cheapestResult.site,
          monitor.origin,
          monitor.destination,
          monitor.departureDate,
          monitor.returnDate,
          monitor.adults,
          monitor.children
        ),
      };
    } else if (priceChanged) {
      const diff = cheapestResult.price - (prevPrice as number);
      const arrow = diff < 0 ? '⬇️ Redução de Preço' : '⬆️ Aumento de Preço';
      triggeredNotification = {
        id: 'not-' + randomUUID().slice(0, 9),
        userId: monitor.userId,
        monitorId: monitor.id,
        origin: monitor.origin,
        destination: monitor.destination,
        title: `${arrow} para ${monitor.destinationCity}`,
        message: `Olá! O preço da sua passagem monitorada variou de R$ ${prevPrice} para R$ ${cheapestResult.price} no site ${cheapestResult.site.toUpperCase()}. Suas datas de viagem são ${travelDatesText}.`,
        price: cheapestResult.price,
        targetPrice: monitor.targetPrice,
        sentTo: monitor.email,
        sentAt: new Date().toISOString(),
        type: 'price_update',
        purchaseUrl: generatePurchaseLink(
          cheapestResult.site,
          monitor.origin,
          monitor.destination,
          monitor.departureDate,
          monitor.returnDate,
          monitor.adults,
          monitor.children
        ),
      };
    }

    if (triggeredNotification) {
      await createNotification(triggeredNotification);
      // Ponteiro fino para o publisher enviar o e-mail de verdade — não
      // substitui a notificação já registrada acima. Ver
      // _local-adr-policy-002 (application).
      await createOutboxEvent({
        type: triggeredNotification.type as 'target_reached' | 'price_update' | 'price_in_range',
        monitorId: monitor.id,
        userId: monitor.userId,
        notificationId: triggeredNotification.id,
      });
    }
  }

  const updatedMonitor = await updateMonitor(monitor.id, {
    currentPrice: cheapestResult.price,
    lastScannedAt: new Date().toISOString(),
    bestPriceTracked,
    history,
    lastScanResults: validResults,
  });

  const batch = db.batch();
  sitesToScan.forEach((siteId) => {
    const ref = db.collection(COLLECTIONS.sites).doc(siteId);
    batch.set(
      ref,
      {
        scrapedCount: FieldValue.increment(1),
        lastScrapedAt: new Date().toISOString(),
        avgResponseMs: Math.round(200 + Math.random() * 500),
      },
      { merge: true }
    );
  });
  await batch.commit();

  return {
    success: true,
    monitor: updatedMonitor as FlightMonitor,
    results,
    generalAnalysis,
    cheapestResult,
    triggeredNotification,
  };
}
