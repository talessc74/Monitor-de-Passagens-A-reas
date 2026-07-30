import Fastify from 'fastify';
import { env } from './env.js';
import { startConsumer, stopConsumer } from './outboxConsumer.js';

/**
 * services/publisher: processo Cloud Run persistente (Fase 5) que
 * consome mpa_outbox e envia os e-mails de verdade via Resend. Servidor
 * HTTP existe só para health check; min-instances=1 mantém o processo
 * vivo. Mesmo padrão de services/generator. Ver _local-adr-policy-002.
 */
async function buildServer() {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  startConsumer();

  const shutdown = async (signal: string) => {
    app.log.info(`[publisher] recebido ${signal}, encerrando com graça...`);
    stopConsumer();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Falha ao iniciar o serviço publisher:', error);
  process.exit(1);
});
