import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import { env } from './env.js';
import { monitorsRoutes } from './routes/monitors.js';
import { sitesRoutes } from './routes/sites.js';
import { notificationsRoutes } from './routes/notifications.js';
import { accountRoutes } from './routes/account.js';
import { billingRoutes } from './routes/billing.js';
import { itinerariesRoutes } from './routes/itineraries.js';

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
  await app.register(itinerariesRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({ error: 'Rota não encontrada' });
  });

  return app;
}

buildServer()
  .then((app) => app.listen({ port: env.PORT, host: '0.0.0.0' }))
  .catch((error) => {
    console.error('Falha ao iniciar o serviço api:', error);
    process.exit(1);
  });
