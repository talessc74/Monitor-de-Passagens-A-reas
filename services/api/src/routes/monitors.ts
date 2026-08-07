import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FlightMonitor, NotificationLog } from '@mpa/types';
import { effectiveLimits, allowedScanIntervals, findAirport } from '@mpa/types';
import {
  listMonitorsForUser,
  getMonitor,
  createMonitor,
  updateMonitor,
  deleteMonitor,
} from '../repositories/monitorsRepository.js';
import { createNotification } from '../repositories/notificationsRepository.js';
import { getUser } from '../repositories/usersRepository.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getRouteStats } from '../routeStats.js';
import { authenticate } from '../auth.js';
import { authenticateInternal } from '../internalAuth.js';
import { executeScanForMonitor } from '../executeScan.js';
import { verifyPauseToken } from '../pauseLink.js';
import { passengerDateSchema, passengerDateUnion } from '../schemas/passengerDate.js';
import { sendRealTestEmail } from '../testEmailSender.js';
import { requestRealSearch } from '../realSearchClient.js';

// Presets fechados de _local-bdr-policy-005 — a UI nunca envia um valor
// livre, então validamos contra o conjunto discreto, não um range.
const marginPresets = [0, 5, 10, 15, 20] as const;
const targetPriceMarginPercentSchema = z.coerce.number().refine((v) => (marginPresets as readonly number[]).includes(v), {
  message: 'targetPriceMarginPercent deve ser um dos presets: 0, 5, 10, 15, 20',
});

const createMonitorSchema = passengerDateUnion({
  originCity: z.string().optional(),
  destinationCity: z.string().optional(),
  targetPrice: z.coerce.number().positive(),
  targetPriceMarginPercent: targetPriceMarginPercentSchema.optional(),
  trackedSites: z.array(z.string()).optional(),
  email: z.string().email(),
  scanIntervalHours: z.coerce.number().int().optional(),
});

// Update é um PATCH parcial e permissivo — não reaplica o discriminated
// union de criação campo a campo, mas o EditMonitorModal (_local-bdr-
// policy-004) permite trocar de modo aqui também, então validamos a
// mesma regra por fora via superRefine: quando o payload inclui
// searchMode: 'dated', departureDate/returnDate precisam vir
// preenchidos — sem isso um monitor "dated" pode ser salvo sem data
// nenhuma (achado de QA, _local-edr-policy-002).
const updateMonitorSchema = z
  .object({
    origin: z.string().min(3).max(4).optional(),
    originCity: z.string().optional(),
    destination: z.string().min(3).max(4).optional(),
    destinationCity: z.string().optional(),
    searchMode: z.enum(['dated', 'anytime']).optional(),
    departureDate: z.string().optional(),
    departDaysBefore: z.coerce.number().int().min(0).max(15).optional(),
    departDaysAfter: z.coerce.number().int().min(0).max(15).optional(),
    returnDate: z.string().optional(),
    returnDaysBefore: z.coerce.number().int().min(0).max(15).optional(),
    returnDaysAfter: z.coerce.number().int().min(0).max(15).optional(),
    earliestDeparture: z.string().optional(),
    latestReturn: z.string().optional(),
    adults: z.coerce.number().int().min(1).optional(),
    children: z.coerce.number().int().min(0).optional(),
    infants: z.coerce.number().int().min(0).optional(),
    targetPrice: z.coerce.number().positive().optional(),
    targetPriceMarginPercent: targetPriceMarginPercentSchema.optional(),
    trackedSites: z.array(z.string()).optional(),
    email: z.string().email().optional(),
    currentPrice: z.number().nullable().optional(),
    bestPriceTracked: z.number().nullable().optional(),
    notificationsEnabled: z.boolean().optional(),
    status: z.enum(['active', 'paused']).optional(),
    scanIntervalHours: z.coerce.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.searchMode === 'dated') {
      if (!data.departureDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['departureDate'], message: 'Data de ida é obrigatória no modo com datas' });
      }
      if (!data.returnDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['returnDate'], message: 'Data de volta é obrigatória no modo com datas' });
      }
    }
    if (data.earliestDeparture && data.latestReturn && data.earliestDeparture > data.latestReturn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latestReturn'],
        message: 'A data limite de retorno não pode ser antes da data mais cedo de saída',
      });
    }
    if (data.origin !== undefined && !findAirport(data.origin)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['origin'], message: `Código de aeroporto inválido: ${data.origin}` });
    }
    if (data.destination !== undefined && !findAirport(data.destination)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destination'], message: `Código de aeroporto inválido: ${data.destination}` });
    }
  });

export async function monitorsRoutes(app: FastifyInstance) {
  app.get('/api/monitors', { preHandler: authenticate }, async (request) => {
    return listMonitorsForUser(request.userId);
  });

  app.get('/api/route-stats', { preHandler: authenticate }, async (request, reply) => {
    const parsed = passengerDateSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parâmetros de rota inválidos', details: parsed.error.flatten() });
    }
    const stats = await getRouteStats(parsed.data);
    return stats;
  });

  app.post('/api/monitors', { preHandler: authenticate }, async (request, reply) => {
    const parsed = createMonitorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Campos obrigatórios ausentes ou inválidos', details: parsed.error.flatten() });
    }
    const body = parsed.data;

    // Limite por plano — conta todos os monitores do usuário, ativos ou
    // pausados, não só os ativos. Contar só ativos permitiria pausar
    // monitores antigos para abrir espaço a novos indefinidamente. Ver
    // _local-adr-policy-003.
    const user = await getUser(request.userId);
    const plan = user?.plan ?? 'free';
    const limits = effectiveLimits(user);
    const existingCount = (await listMonitorsForUser(request.userId)).length;
    if (existingCount >= limits.maxMonitors) {
      return reply.status(403).send({
        error: `Limite de ${limits.maxMonitors} monitores do plano ${plan === 'free' ? 'Gratuito' : 'Pro'} atingido.`,
        upgradeRequired: plan === 'free' && !user?.isAdmin,
      });
    }

    const allowedIntervals = allowedScanIntervals(user);
    if (body.scanIntervalHours !== undefined && !allowedIntervals.includes(body.scanIntervalHours)) {
      return reply.status(403).send({
        error: 'Varredura de hora em hora é exclusiva do plano Pro. No plano Gratuito, a frequência é sempre de 6 em 6 horas.',
        upgradeRequired: plan === 'free' && !user?.isAdmin,
      });
    }

    const monitor: FlightMonitor = {
      id: 'mon-' + randomUUID().slice(0, 9),
      userId: request.userId,
      origin: body.origin.toUpperCase().trim(),
      originCity: body.originCity || body.origin,
      destination: body.destination.toUpperCase().trim(),
      destinationCity: body.destinationCity || body.destination,
      searchMode: body.searchMode,
      ...(body.searchMode === 'dated'
        ? {
            departureDate: body.departureDate,
            departDaysBefore: body.departDaysBefore,
            departDaysAfter: body.departDaysAfter,
            returnDate: body.returnDate,
            returnDaysBefore: body.returnDaysBefore,
            returnDaysAfter: body.returnDaysAfter,
          }
        : {
            ...(body.earliestDeparture ? { earliestDeparture: body.earliestDeparture } : {}),
            ...(body.latestReturn ? { latestReturn: body.latestReturn } : {}),
          }),
      adults: body.adults,
      children: body.children,
      infants: body.infants,
      targetPrice: body.targetPrice,
      targetPriceMarginPercent: body.targetPriceMarginPercent ?? 0,
      currentPrice: null,
      bestPriceTracked: null,
      trackedSites: body.trackedSites && body.trackedSites.length ? body.trackedSites : ['latam', 'gol', 'azul', 'decolar'],
      notificationsEnabled: true,
      email: body.email,
      ...(body.scanIntervalHours !== undefined ? { scanIntervalHours: body.scanIntervalHours } : {}),
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

    if (parsed.data.scanIntervalHours !== undefined) {
      const user = await getUser(request.userId);
      const allowedIntervals = allowedScanIntervals(user);
      if (!allowedIntervals.includes(parsed.data.scanIntervalHours)) {
        return reply.status(403).send({
          error: 'Varredura de hora em hora é exclusiva do plano Pro. No plano Gratuito, a frequência é sempre de 6 em 6 horas.',
          upgradeRequired: (user?.plan ?? 'free') === 'free' && !user?.isAdmin,
        });
      }
    }

    // Editar para 'anytime' precisa remover de fato os campos de data —
    // um merge-write normal só sobrescreve chaves presentes, nunca as
    // apaga. Ver _local-edr-policy-003.
    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.searchMode === 'anytime') {
      for (const field of [
        'departureDate',
        'departDaysBefore',
        'departDaysAfter',
        'returnDate',
        'returnDaysBefore',
        'returnDaysAfter',
      ]) {
        patch[field] = FieldValue.delete();
      }
      if (!parsed.data.earliestDeparture) patch.earliestDeparture = FieldValue.delete();
      if (!parsed.data.latestReturn) patch.latestReturn = FieldValue.delete();
    } else if (parsed.data.searchMode === 'dated') {
      patch.earliestDeparture = FieldValue.delete();
      patch.latestReturn = FieldValue.delete();
    }

    const updated = await updateMonitor(request.params.id, patch);
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

  // Link "pausar monitor" clicado a partir de um e-mail — sem login,
  // autorizado por um token assinado (não Firebase auth). Ver
  // _local-edr-policy-004.
  app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/api/monitors/:id/pause',
    async (request, reply) => {
      const token = request.query.token;
      if (!token || !verifyPauseToken(request.params.id, token)) {
        return reply.status(401).send({ error: 'Link inválido ou expirado' });
      }
      const existing = await getMonitor(request.params.id);
      if (!existing) {
        return reply.status(404).send({ error: 'Monitor não encontrado' });
      }
      await updateMonitor(request.params.id, { status: 'paused' });
      return { success: true, message: 'Monitor pausado com sucesso.' };
    }
  );

  app.post<{ Params: { id: string } }>('/api/monitors/:id/scan', { preHandler: authenticate }, async (request, reply) => {
    const monitor = await getMonitor(request.params.id);
    if (!monitor || monitor.userId !== request.userId) {
      return reply.status(404).send({ error: 'Monitor não encontrado' });
    }

    try {
      return await executeScanForMonitor(monitor);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      request.log.error({ err: error, monitorId: monitor.id }, 'Falha durante o escaneamento');
      return reply.status(500).send({ error: 'Falha ao escanear tarifas aéreas', details: message });
    }
  });

  // Busca de preço real sob demanda — abre um navegador de verdade
  // (services/scraper) só quando o usuário clica, nunca em loop
  // automático (bloqueio de bot é o risco real de automatizar isso,
  // ver _local-bdr-policy-015). Distinta de /scan: não atualiza
  // currentPrice/history nem dispara notificação, é uma consulta
  // pontual mostrada só na hora.
  app.post<{ Params: { id: string } }>('/api/monitors/:id/real-search', { preHandler: authenticate }, async (request, reply) => {
    const monitor = await getMonitor(request.params.id);
    if (!monitor || monitor.userId !== request.userId) {
      return reply.status(404).send({ error: 'Monitor não encontrado' });
    }

    try {
      return await requestRealSearch({
        origin: monitor.origin,
        destination: monitor.destination,
        departureDate:
          monitor.departureDate ?? monitor.earliestDeparture ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        returnDate: monitor.returnDate,
        adults: monitor.adults,
        children: monitor.children,
      });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'NOT_CONFIGURED') {
        return reply.status(503).send({ error: 'Busca de preço real não está disponível neste ambiente ainda.' });
      }
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      request.log.error({ err: error, monitorId: monitor.id }, 'Falha na busca de preço real');
      return reply.status(502).send({ error: 'Falha ao buscar preço real', details: message });
    }
  });

  // Rota de serviço-a-serviço, chamada pelo loop de polling do
  // services/generator (Fase 4) — sem token de usuário Firebase, o
  // scan é disparado pelo scheduler, não por um clique. Ver
  // _local-adr-policy-002.
  app.post<{ Params: { id: string } }>('/internal/scan/:id', { preHandler: authenticateInternal }, async (request, reply) => {
    const monitor = await getMonitor(request.params.id);
    if (!monitor) {
      return reply.status(404).send({ error: 'Monitor não encontrado' });
    }

    try {
      return await executeScanForMonitor(monitor);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      request.log.error({ err: error, monitorId: monitor.id }, 'Falha durante o escaneamento (interno)');
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

    const result = await sendRealTestEmail({ to, subject, content });

    const testNotif: NotificationLog = {
      id: 'not-test-' + Date.now(),
      userId: request.userId,
      monitorId: 'test',
      origin: 'TEST',
      destination: 'TEST',
      title: `${result.sent ? 'Alerta de Teste (enviado via Resend)' : 'Simulação de Canal Ativo'}: ${subject}`,
      message: content,
      price: 0,
      targetPrice: 0,
      sentTo: to,
      sentAt: new Date().toISOString(),
      type: 'promotion',
    };
    await createNotification(testNotif);

    if (result.error) {
      return reply.status(502).send({ error: 'Falha ao enviar via Resend', details: result.error, notification: testNotif });
    }

    return {
      success: true,
      sentReal: result.sent,
      message: result.sent
        ? `E-mail real enviado via Resend para ${to}`
        : `RESEND_API_KEY não configurada neste ambiente — e-mail simulado (não enviado de verdade) para ${to}`,
      notification: testNotif,
    };
  });
}
