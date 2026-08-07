import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../auth.js';
import { getUserByEmail, listAllUsers, updateUser } from '../repositories/usersRepository.js';
import { purgeSimulatedPrices } from '../repositories/monitorsRepository.js';
import { env } from '../env.js';
import {
  testConnection as testTravelpayoutsConnection,
  listCachedDestinations,
  mapCoverage,
  testRoute as testTravelpayoutsRoute,
} from '../travelpayoutsClient.js';
import { testConnection as testSkyScrapperConnection } from '../skyScrapperClient.js';

/**
 * Gestão manual de acesso total (dev/beta-tester), fora do fluxo de
 * pagamento do Stripe — ver _local-adr-policy-002 (controls). Só quem
 * já está na allowlist ADMIN_EMAILS (env.ts) pode chamar isto; não há
 * caminho de auto-promoção a partir de uma conta comum.
 */
const grantAdminSchema = z.object({
  email: z.string().email(),
  isAdmin: z.boolean(),
});

export async function adminRoutes(app: FastifyInstance) {
  // Lista todo mundo que já logou pelo menos uma vez, pra escolher quem
  // promover sem precisar saber/digitar o e-mail de cor.
  app.get('/api/admin/users', { preHandler: [authenticate, requireAdmin] }, async () => {
    return listAllUsers();
  });

  app.post('/api/admin/grant-access', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const parsed = grantAdminSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Parâmetros 'email' e 'isAdmin' são necessários", details: parsed.error.flatten() });
    }

    const target = await getUserByEmail(parsed.data.email);
    if (!target) {
      return reply.status(404).send({ error: 'Nenhum usuário com esse e-mail fez login ainda' });
    }

    await updateUser(target.uid, { isAdmin: parsed.data.isAdmin });
    return { success: true, email: parsed.data.email, isAdmin: parsed.data.isAdmin };
  });

  // Testa as fontes de preço real de verdade (chamada mínima e barata a
  // cada uma), em vez de só reportar se a variável de ambiente existe —
  // uma key presente mas inválida/sem cota passaria despercebida num
  // check só de presença. Ver _local-bdr-policy-010.
  app.get('/api/admin/diagnostics', { preHandler: [authenticate, requireAdmin] }, async () => {
    const [travelpayouts, skyScrapper] = await Promise.all([testTravelpayoutsConnection(), testSkyScrapperConnection()]);
    return {
      travelpayouts,
      skyScrapper,
      gemini: { configured: Boolean(env.GEMINI_API_KEY) },
    };
  });

  // "Quais destinos saindo de X têm cobertura real no Travelpayouts?" —
  // ver _local-bdr-policy-011. Evita cadastrar um monitor por destino só
  // pra descobrir na marra se aquela rota tem dado real ou cai no
  // simulador.
  app.get<{ Querystring: { origin?: string } }>(
    '/api/admin/travelpayouts-routes',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const origin = request.query.origin?.toUpperCase().trim();
      if (!origin || origin.length < 3 || origin.length > 4) {
        return reply.status(400).send({ error: "Parâmetro 'origin' precisa ser um código IATA (3-4 letras)" });
      }
      const result = await listCachedDestinations(origin);
      return { origin, ...result };
    }
  );

  // Limpeza única dos preços herdados do simulador — ver
  // _local-bdr-policy-016 e purgeSimulatedPrices(). Manual e sob
  // demanda, não automático no boot: apagar histórico de preço é
  // destrutivo e irreversível, então quem puxa o gatilho é uma pessoa,
  // com a intenção explícita, não um deploy.
  app.post('/api/admin/purge-simulated-prices', { preHandler: [authenticate, requireAdmin] }, async () => {
    return purgeSimulatedPrices();
  });

  // Mapa de cobertura em lote: varre todos os aeroportos brasileiros
  // relevantes de uma vez e responde "de que tamanho é o produto que dá
  // pra construir com dado real?" — a medição que decide o rumo do
  // FlySpot. Ver _local-bdr-policy-016. Sem cache: é consulta manual e
  // rara, e um número velho aqui vale menos que a espera de alguns
  // segundos.
  app.get('/api/admin/coverage-map', { preHandler: [authenticate, requireAdmin] }, async () => {
    return mapCoverage();
  });

  // Testa uma rota origin->destination específica com a mesma chamada
  // que o scan real faz — pra depurar o caso "apareceu no explorador de
  // destinos, mas o scan real continua vindo simulado". Ver
  // _local-bdr-policy-012.
  app.get<{ Querystring: { origin?: string; destination?: string } }>(
    '/api/admin/travelpayouts-route-test',
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const origin = request.query.origin?.toUpperCase().trim();
      const destination = request.query.destination?.toUpperCase().trim();
      if (!origin || !destination || origin.length < 3 || destination.length < 3) {
        return reply.status(400).send({ error: "Parâmetros 'origin' e 'destination' precisam ser códigos IATA (3-4 letras)" });
      }
      const result = await testTravelpayoutsRoute(origin, destination);
      return { origin, destination, ...result };
    }
  );
}
