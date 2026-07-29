import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FlightMonitor, NotificationLog } from '@mpa/types';
import {
  listMonitorsForUser,
  getMonitor,
  createMonitor,
  updateMonitor,
  deleteMonitor,
} from '../repositories/monitorsRepository.js';
import { createNotification } from '../repositories/notificationsRepository.js';
import { db, COLLECTIONS } from '../firestore.js';
import { FieldValue } from 'firebase-admin/firestore';
import { runScanSimulation } from '../scanSimulator.js';
import { generatePurchaseLink } from '../purchaseLink.js';
import { authenticate } from '../auth.js';

const createMonitorSchema = z.object({
  origin: z.string().min(3).max(4),
  originCity: z.string().optional(),
  destination: z.string().min(3).max(4),
  destinationCity: z.string().optional(),
  departureDate: z.string().min(1),
  returnDate: z.string().min(1),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  targetPrice: z.coerce.number().positive(),
  trackedSites: z.array(z.string()).optional(),
  email: z.string().email(),
});

const updateMonitorSchema = createMonitorSchema.partial().extend({
  currentPrice: z.number().nullable().optional(),
  bestPriceTracked: z.number().nullable().optional(),
  notificationsEnabled: z.boolean().optional(),
  status: z.enum(['active', 'paused']).optional(),
});

export async function monitorsRoutes(app: FastifyInstance) {
  app.get('/api/monitors', { preHandler: authenticate }, async (request) => {
    return listMonitorsForUser(request.userId);
  });

  app.post('/api/monitors', { preHandler: authenticate }, async (request, reply) => {
    const parsed = createMonitorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Campos obrigatórios ausentes ou inválidos', details: parsed.error.flatten() });
    }
    const body = parsed.data;

    const monitor: FlightMonitor = {
      id: 'mon-' + randomUUID().slice(0, 9),
      userId: request.userId,
      origin: body.origin.toUpperCase().trim(),
      originCity: body.originCity || body.origin,
      destination: body.destination.toUpperCase().trim(),
      destinationCity: body.destinationCity || body.destination,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      adults: body.adults,
      children: body.children,
      targetPrice: body.targetPrice,
      currentPrice: null,
      bestPriceTracked: null,
      trackedSites: body.trackedSites && body.trackedSites.length ? body.trackedSites : ['latam', 'gol', 'azul', 'decolar'],
      notificationsEnabled: true,
      email: body.email,
      createdAt: new Date().toISOString(),
      lastScannedAt: null,
      nextScanAt: new Date().toISOString(),
      history: [],
      status: 'active',
    };

    await createMonitor(monitor);
    return monitor;
  });

  app.put<{ Params: { id: string } }>('/api/monitors/:id', { preHandler: authenticate }, async (request, reply) => {
    const existing = await getMonitor(request.params.id);
    if (!existing || existing.userId !== request.userId) {
      return reply.status(404).send({ error: 'Monitor não encontrado' });
    }
    const parsed = updateMonitorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const updated = await updateMonitor(request.params.id, parsed.data);
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/api/monitors/:id', { preHandler: authenticate }, async (request, reply) => {
    const existing = await getMonitor(request.params.id);
    if (!existing || existing.userId !== request.userId) {
      return reply.status(404).send({ error: 'Monitor não encontrado' });
    }
    await deleteMonitor(request.params.id);
    return { success: true };
  });

  app.post<{ Params: { id: string } }>('/api/monitors/:id/scan', { preHandler: authenticate }, async (request, reply) => {
    const monitor = await getMonitor(request.params.id);
    if (!monitor || monitor.userId !== request.userId) {
      return reply.status(404).send({ error: 'Monitor não encontrado' });
    }

    const sitesToScan = monitor.trackedSites.length > 0 ? monitor.trackedSites : ['latam', 'gol', 'azul', 'decolar'];

    try {
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
        !monitor.bestPriceTracked || cheapestResult.price < monitor.bestPriceTracked
          ? cheapestResult.price
          : monitor.bestPriceTracked;

      const history = [...monitor.history, { date: new Date().toISOString(), price: cheapestResult.price, site: cheapestResult.site }];
      if (history.length > 20) {
        history.shift();
      }

      let triggeredNotification: NotificationLog | null = null;
      const isUnderTarget = cheapestResult.price <= monitor.targetPrice;
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
            message: `O site de passagens ${cheapestResult.site.toUpperCase()} atingiu um valor incrível de R$ ${cheapestResult.price} para as datas de sua viagem (${monitor.departureDate} a ${monitor.returnDate}). Este valor está abaixo da sua meta estipulada de R$ ${monitor.targetPrice}!`,
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
            message: `Olá! O preço da sua passagem monitorada variou de R$ ${prevPrice} para R$ ${cheapestResult.price} no site ${cheapestResult.site.toUpperCase()}. Suas datas de viagem são ${monitor.departureDate} a ${monitor.returnDate}.`,
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
        }
      }

      const updatedMonitor = await updateMonitor(monitor.id, {
        currentPrice: cheapestResult.price,
        lastScannedAt: new Date().toISOString(),
        bestPriceTracked,
        history,
      });

      // Atualiza estatísticas dos sites consultados
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
        monitor: updatedMonitor,
        results,
        generalAnalysis,
        cheapestResult,
        triggeredNotification,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      request.log.error({ err: error, monitorId: monitor.id }, 'Falha durante o escaneamento');
      return reply.status(500).send({ error: 'Falha ao escanear tarifas aéreas', details: message });
    }
  });

  const testEmailSchema = z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    content: z.string().min(1),
  });

  app.post('/api/test-email', { preHandler: authenticate }, async (request, reply) => {
    const parsed = testEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parâmetros 'to', 'subject' e 'content' são necessários." });
    }
    const { to, subject, content } = parsed.data;

    const testNotif: NotificationLog = {
      id: 'not-test-' + Date.now(),
      userId: request.userId,
      monitorId: 'test',
      origin: 'TEST',
      destination: 'TEST',
      title: `Simulação de Canal Ativo: ${subject}`,
      message: content,
      price: 0,
      targetPrice: 0,
      sentTo: to,
      sentAt: new Date().toISOString(),
      type: 'promotion',
    };

    await createNotification(testNotif);
    return { success: true, message: 'E-mail de teste simulado enviado com sucesso para ' + to, notification: testNotif };
  });
}
