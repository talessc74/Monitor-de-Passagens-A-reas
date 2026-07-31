import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { ItineraryMonitor } from '@mpa/types';
import {
  listItineraryMonitorsForUser,
  getItineraryMonitor,
  createItineraryMonitor,
  deleteItineraryMonitor,
} from '../repositories/itineraryMonitorsRepository.js';
import { getUser } from '../repositories/usersRepository.js';
import { authenticate } from '../auth.js';
import { authenticateInternal } from '../internalAuth.js';
import { LIABILITY_DISCLAIMER } from '../itinerarySearch.js';
import { executeItineraryScan } from '../executeItineraryScan.js';
import { createItinerarySchema } from '../schemas/itinerary.js';

export async function itinerariesRoutes(app: FastifyInstance) {
  app.get('/api/itineraries', { preHandler: authenticate }, async (request) => {
    return listItineraryMonitorsForUser(request.userId);
  });

  app.post('/api/itineraries', { preHandler: authenticate }, async (request, reply) => {
    const user = await getUser(request.userId);
    const plan = user?.plan ?? 'free';
    if (plan !== 'pro') {
      return reply.status(403).send({
        error: 'Itinerários multi-trecho são exclusivos do plano Pro.',
        upgradeRequired: true,
      });
    }

    const parsed = createItinerarySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Campos obrigatórios ausentes ou inválidos', details: parsed.error.flatten() });
    }
    const body = parsed.data;

    const monitor: ItineraryMonitor = {
      id: 'itin-' + randomUUID().slice(0, 9),
      userId: request.userId,
      origin: body.origin.toUpperCase().trim(),
      finalDestination: body.finalDestination.toUpperCase().trim(),
      maxLegs: body.maxLegs,
      maxLayoverHours: body.maxLayoverHours,
      allowOvernightLayovers: body.allowOvernightLayovers,
      dateWindowStart: body.dateWindowStart,
      dateWindowEnd: body.dateWindowEnd,
      targetPrice: body.targetPrice,
      currentBestItinerary: null,
      currentBestTotal: null,
      directBaselinePrice: null,
      history: [],
      notificationsEnabled: true,
      email: body.email,
      createdAt: new Date().toISOString(),
      lastScannedAt: null,
      nextScanAt: new Date().toISOString(),
      status: 'active',
    };

    await createItineraryMonitor(monitor);
    return { ...monitor, liabilityDisclaimer: LIABILITY_DISCLAIMER };
  });

  app.delete<{ Params: { id: string } }>('/api/itineraries/:id', { preHandler: authenticate }, async (request, reply) => {
    const existing = await getItineraryMonitor(request.params.id);
    if (!existing || existing.userId !== request.userId) {
      return reply.status(404).send({ error: 'Itinerário não encontrado' });
    }
    await deleteItineraryMonitor(request.params.id);
    return { success: true };
  });

  app.post<{ Params: { id: string } }>('/api/itineraries/:id/scan', { preHandler: authenticate }, async (request, reply) => {
    const monitor = await getItineraryMonitor(request.params.id);
    if (!monitor || monitor.userId !== request.userId) {
      return reply.status(404).send({ error: 'Itinerário não encontrado' });
    }

    try {
      return await executeItineraryScan(monitor);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      request.log.error({ err: error, itineraryId: monitor.id }, 'Falha durante o scan de itinerário');
      return reply.status(500).send({ error: 'Falha ao calcular itinerário', details: message });
    }
  });

  // Rota de serviço-a-serviço, chamada pelo scheduler do services/generator
  // — mesmo padrão de /internal/scan/:id (_local-adr-policy-002).
  app.post<{ Params: { id: string } }>(
    '/internal/itinerary-scan/:id',
    { preHandler: authenticateInternal },
    async (request, reply) => {
      const monitor = await getItineraryMonitor(request.params.id);
      if (!monitor) {
        return reply.status(404).send({ error: 'Itinerário não encontrado' });
      }

      try {
        return await executeItineraryScan(monitor);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        request.log.error({ err: error, itineraryId: monitor.id }, 'Falha durante o scan de itinerário (interno)');
        return reply.status(500).send({ error: 'Falha ao calcular itinerário', details: message });
      }
    }
  );
}
