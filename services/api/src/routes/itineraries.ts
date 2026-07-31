import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ItineraryMonitor } from '@mpa/types';
import {
  listItineraryMonitorsForUser,
  getItineraryMonitor,
  createItineraryMonitor,
  updateItineraryMonitor,
  deleteItineraryMonitor,
} from '../repositories/itineraryMonitorsRepository.js';
import { getUser } from '../repositories/usersRepository.js';
import { authenticate } from '../auth.js';
import { findCheapestItinerary, beatsBaselineByMargin, MIN_CONNECTION_HOURS, LIABILITY_DISCLAIMER } from '../itinerarySearch.js';
import { getRouteStats } from '../routeStats.js';

// Fase 9 ("Itinerários") — ver _local-bdr-plan-003. Exclusivo do plano
// Pro: precificar um itinerário multi-trecho custa uma chamada por
// trecho candidato, não uma só, como o scan de um FlightMonitor normal.
const createItinerarySchema = z
  .object({
    origin: z.string().min(3).max(4),
    finalDestination: z.string().min(3).max(4),
    maxLegs: z.coerce.number().int().min(1).max(4).default(4),
    maxLayoverHours: z.coerce.number().min(1).max(24).default(6),
    allowOvernightLayovers: z.boolean().default(false),
    dateWindowStart: z.string(),
    dateWindowEnd: z.string(),
    targetPrice: z.coerce.number().positive(),
    adults: z.coerce.number().int().min(1).default(1),
    children: z.coerce.number().int().min(0).default(0),
    email: z.string().email(),
    // Reconhecimento explícito do LIABILITY_DISCLAIMER — não é um
    // checkbox pré-marcado nem um texto de rodapé ignorável, é campo
    // obrigatório na criação. Decisão do dono do produto (2026-07-31).
    riskAcknowledged: z.literal(true, {
      errorMap: () => ({ message: 'É necessário confirmar que leu o aviso sobre risco de conexão e responsabilidade.' }),
    }),
  })
  .superRefine((data, ctx) => {
    // Sem pernoite habilitado, o teto de conexão do usuário precisa
    // caber acima do mínimo de segurança — senão nenhuma aresta do grafo
    // jamais passaria no filtro de MIN_CONNECTION_HOURS.
    if (!data.allowOvernightLayovers && data.maxLayoverHours < MIN_CONNECTION_HOURS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxLayoverHours'],
        message: `maxLayoverHours precisa ser pelo menos ${MIN_CONNECTION_HOURS}h (mínimo de segurança de conexão) quando pernoite não é permitido.`,
      });
    }
  });

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

      const patch: Partial<Record<keyof ItineraryMonitor, unknown>> = {
        lastScannedAt: new Date().toISOString(),
        directBaselinePrice,
        currentBestItinerary: worthRecommending && itinerary ? itinerary.legs : null,
        currentBestTotal: worthRecommending && itinerary ? itinerary.total : null,
      };
      const updated = await updateItineraryMonitor(monitor.id, patch);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      request.log.error({ err: error, itineraryId: monitor.id }, 'Falha durante o scan de itinerário');
      return reply.status(500).send({ error: 'Falha ao calcular itinerário', details: message });
    }
  });
}
