import path from 'node:path';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { env } from './env.js';
import { monitorsRoutes } from './routes/monitors.js';
import { sitesRoutes } from './routes/sites.js';
import { notificationsRoutes } from './routes/notifications.js';
import { accountRoutes } from './routes/account.js';
import { billingRoutes } from './routes/billing.js';

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(helmet);
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  await app.register(monitorsRoutes);
  await app.register(sitesRoutes);
  await app.register(notificationsRoutes);
  await app.register(accountRoutes);
  await app.register(billingRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  if (env.NODE_ENV === 'production') {
    // Serve o build estático do frontend (Vite), copiado para ./web-dist
    // pelo Dockerfile. Substituído pelo deploy separado na Vercel a partir
    // da Fase 2 (Next.js).
    const distPath = path.resolve(process.cwd(), 'web-dist');
    await app.register(fastifyStatic, { root: distPath });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api')) {
        return reply.status(404).send({ error: 'Rota não encontrada' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}

buildServer()
  .then((app) => app.listen({ port: env.PORT, host: '0.0.0.0' }))
  .catch((error) => {
    console.error('Falha ao iniciar o serviço api:', error);
    process.exit(1);
  });
