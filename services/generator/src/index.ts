import Fastify from 'fastify';
import { env } from './env.js';
import { startScheduler, stopScheduler } from './scheduler.js';
import { purgeHistory } from './purgeHistory.js';

/**
 * services/generator: processo Cloud Run persistente cujo único papel,
 * na Fase 4, é rodar o loop de polling do scheduler. O servidor HTTP
 * existe só para health check (Cloud Run exige uma porta escutando) e
 * min-instances=1 mantém o processo vivo mesmo sem tráfego HTTP. Ver
 * _local-adr-policy-002.
 */
async function buildServer() {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  startScheduler();

  let purgeTimer: NodeJS.Timeout | null = null;
  const runPurge = async () => {
    try {
      const stats = await purgeHistory();
      if (stats.monitorsTrimmed > 0) {
        app.log.info(stats, '[generator] expurgo de histórico concluído');
      }
    } catch (error) {
      app.log.error({ err: error }, '[generator] erro no expurgo de histórico');
    }
  };
  runPurge();
  purgeTimer = setInterval(runPurge, env.PURGE_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    app.log.info(`[generator] recebido ${signal}, encerrando com graça...`);
    stopScheduler();
    if (purgeTimer) clearInterval(purgeTimer);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Falha ao iniciar o serviço generator:', error);
  process.exit(1);
});
