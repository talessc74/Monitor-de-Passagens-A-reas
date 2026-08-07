import { randomUUID } from 'node:crypto';
import type { FlightMonitor, NotificationLog, ScanResponse, ScanResult } from '@mpa/types';
import { updateMonitor } from './repositories/monitorsRepository.js';
import { createNotification } from './repositories/notificationsRepository.js';
import { createOutboxEvent } from './repositories/outboxRepository.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getCheapestRealFare } from './travelpayoutsClient.js';
import { getCheapestRealFare as getCheapestSkyScrapperFare } from './skyScrapperClient.js';
import { searchItinerary, beatsBaselineByMargin, LIABILITY_DISCLAIMER } from './itinerarySearch.js';
import { generatePurchaseLink } from './purchaseLink.js';

/**
 * Teto de saltos e janela de conexão usados quando o "Modo Tieni"
 * ("Só me importa o preço") busca um itinerário multi-trecho alternativo
 * — ver _local-bdr-policy-013. maxLegs=2 (uma conexão só) mantém o custo
 * de chamadas ao Travelpayouts controlável mesmo com o cache de
 * itinerarySearch.ts; pernoite sempre permitido, por pedido explícito do
 * dono do produto.
 */
const TIENI_ITINERARY_MAX_LEGS = 2;
const TIENI_ITINERARY_MAX_LAYOVER_HOURS = 6;

/**
 * Lógica de execução de um scan — extraída para ser reaproveitada tanto
 * pela rota autenticada (POST /api/monitors/:id/scan, "Varrer Agora")
 * quanto pela rota interna (POST /internal/scan/:id, chamada pelo loop
 * de polling do services/generator). Ver _local-adr-policy-002.
 */
export async function executeScanForMonitor(monitor: FlightMonitor): Promise<ScanResponse> {
  // Fontes de preço real do FlySpot, em cascata — ver _local-adr-policy-004
  // (application). Travelpayouts primeiro (cache, mais barato/rápido de
  // consultar); se não tiver cobertura pra rota, tenta o Sky Scrapper
  // (busca ao vivo). Quando nenhuma das duas tem dado, o scan termina sem
  // preço — não há mais simulador atrás pra preencher o silêncio. Ver
  // _local-bdr-policy-016.
  const realFare =
    (await getCheapestRealFare(monitor.origin, monitor.destination)) ??
    (await getCheapestSkyScrapperFare(monitor.origin, monitor.destination, monitor.departureDate ?? null));

  const validResults: ScanResult[] = realFare && realFare.price > 0 ? [realFare] : [];
  const directCheapest = validResults[0];

  // Nenhuma fonte real cobre esta rota agora. Isso é um resultado, não
  // uma falha: a tentativa fica registrada (lastScannedAt avança, então
  // o scheduler reagenda normalmente), mas currentPrice, history e
  // bestPriceTracked ficam intocados — inventar número aqui foi
  // exatamente o que a _local-bdr-policy-016 veio encerrar. Sem preço
  // não há meta batida, logo não há notificação nem e-mail.
  if (!directCheapest) {
    const untouched = await updateMonitor(monitor.id, { lastScannedAt: new Date().toISOString() });
    return {
      success: true,
      monitor: untouched as FlightMonitor,
      results: [],
      cheapestResult: null,
      triggeredNotification: null,
    };
  }

  // "Modo Tieni" — no modo 'anytime', busca também um itinerário
  // multi-trecho (origem -> hub -> destino, pernoite permitido) e só o
  // usa se ficar mais barato que a passagem direta por margem
  // suficiente (mesmo critério de _local-bdr-plan-003). O resultado da
  // TENTATIVA fica registrado sempre — ganhando ou perdendo — pra UI
  // nunca ficar em silêncio sobre uma busca que rodou. Ver
  // _local-bdr-policy-013 e _local-bdr-policy-014.
  let itineraryLegs: FlightMonitor['lastItineraryLegs'];
  let itinerarySearchRecord: FlightMonitor['lastItinerarySearch'];
  if (monitor.searchMode === 'anytime') {
    const attempt = await searchItinerary({
      origin: monitor.origin,
      finalDestination: monitor.destination,
      maxLegs: TIENI_ITINERARY_MAX_LEGS,
      maxLayoverHours: TIENI_ITINERARY_MAX_LAYOVER_HOURS,
      allowOvernightLayovers: true,
      adults: monitor.adults,
      children: monitor.children,
      targetPrice: monitor.targetPrice,
    });

    const itinerary = attempt.best;
    const won = Boolean(
      itinerary && itinerary.legs.length > 1 && beatsBaselineByMargin(itinerary.total, directCheapest.price)
    );

    itinerarySearchRecord = {
      hubs: attempt.hubs,
      bestTotal: itinerary ? itinerary.total : null,
      bestLegs: itinerary && itinerary.legs.length > 1 ? itinerary.legs : null,
      directPrice: directCheapest.price,
      won,
    };

    if (won && itinerary) {
      itineraryLegs = itinerary.legs;
      const routeText = [monitor.origin, ...itinerary.legs.map((l) => l.destination)].join(' → ');
      const legsText = itinerary.legs.map((l) => `${l.origin}→${l.destination} R$ ${l.price}`).join(' + ');
      validResults.push({
        site: 'Itinerário multi-trecho',
        price: itinerary.total,
        durationHours: 0,
        stops: itinerary.legs.length - 1,
        isPromotion: false,
        details: `Roteiro ${routeText} (${legsText}). ${LIABILITY_DISCLAIMER}`,
      });
      validResults.sort((a, b) => a.price - b.price);
    }
  }

  const cheapestResult = validResults[0];

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
      : monitor.earliestDeparture || monitor.latestReturn
      ? `qualquer data entre ${monitor.earliestDeparture ?? 'hoje'} e ${monitor.latestReturn ?? 'sem limite'}`
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
      // 'price_update' (preço só variou, sem bater meta nem faixa de
      // aviso) continua aparecendo no feed do dashboard acima, mas não
      // vira e-mail — e-mail é só pra target_reached/price_in_range, os
      // dois sinais que o usuário pediu pra ser avisado de verdade. Ver
      // _local-bdr-policy-008 (revisão de _local-bdr-policy-005: o
      // "price changed" antes gerava e-mail a cada scan com preço
      // diferente, inclusive Pro escaneando de hora em hora).
      if (triggeredNotification.type !== 'price_update') {
        // Ponteiro fino para o publisher enviar o e-mail de verdade — não
        // substitui a notificação já registrada acima. Ver
        // _local-adr-policy-002 (application).
        await createOutboxEvent({
          type: triggeredNotification.type as 'target_reached' | 'price_in_range',
          monitorId: monitor.id,
          userId: monitor.userId,
          notificationId: triggeredNotification.id,
        });
      }
    }
  }

  const updatedMonitor = await updateMonitor(monitor.id, {
    currentPrice: cheapestResult.price,
    lastScannedAt: new Date().toISOString(),
    lastPriceFoundAt: new Date().toISOString(),
    bestPriceTracked,
    history,
    lastScanResults: validResults,
    lastItineraryLegs: itineraryLegs ?? FieldValue.delete(),
    lastItinerarySearch: itinerarySearchRecord ?? FieldValue.delete(),
  });

  return {
    success: true,
    monitor: updatedMonitor as FlightMonitor,
    results: validResults,
    cheapestResult,
    triggeredNotification,
  };
}
