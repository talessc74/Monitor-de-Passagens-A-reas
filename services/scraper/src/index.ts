import Fastify from 'fastify';
import { z } from 'zod';
import { env } from './env.js';
import { searchRealPrice } from './skyscannerScraper.js';

/**
 * services/scraper: serviço isolado dos demais (Cloud Run próprio) que
 * abre um navegador de verdade sob demanda pra buscar preço real —
 * separado de propósito do flyspot-api, pra uma falha de build/deploy
 * aqui (imagem nova, dependência pesada) nunca arrastar o resto do
 * sistema, que já funciona. Ver _local-bdr-policy-015.
 */

const searchSchema = z.object({
  origin: z.string().min(3).max(4),
  destination: z.string().min(3).max(4),
  departureDate: z.string().min(1),
  returnDate: z.string().optional(),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
});

async function buildServer() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/internal/real-search', async (request, reply) => {
    const token = request.headers['x-internal-token'];
    if (token !== env.INTERNAL_SCAN_TOKEN) {
      return reply.status(401).send({ error: 'Token interno inválido ou ausente' });
    }

    const parsed = searchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parâmetros inválidos', details: parsed.error.flatten() });
    }

    try {
      // Construído explícito (em vez de passar parsed.data direto) —
      // o tsconfig raiz do monorepo não liga "strict", e sem
      // strictNullChecks a inferência de tipo do zod pra campos com
      // .default() degrada pra tudo opcional nesse tsc específico
      // (não acontece rodando só dentro deste workspace, que tem
      // "strict": true no seu próprio tsconfig.json).
      const result = await searchRealPrice({
        origin: parsed.data.origin,
        destination: parsed.data.destination,
        departureDate: parsed.data.departureDate,
        returnDate: parsed.data.returnDate,
        adults: parsed.data.adults,
        children: parsed.data.children,
      });
      return result;
    } catch (error) {
      request.log.error({ err: error }, 'Falha ao buscar preço real');
      return reply.status(500).send({ error: 'Falha ao buscar preço real', details: error instanceof Error ? error.message : 'desconhecido' });
    }
  });

  return app;
}

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error('Falha ao iniciar o serviço scraper:', error);
  process.exit(1);
});
