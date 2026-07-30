import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from './env.js';

/**
 * Autenticação de serviço-a-serviço para rotas /internal/* — usada pelo
 * loop de polling do services/generator, que não tem um usuário Firebase
 * logado para autenticar como. Ver _local-adr-policy-002.
 */
export async function authenticateInternal(request: FastifyRequest, reply: FastifyReply) {
  if (!env.INTERNAL_SCAN_TOKEN) {
    return reply.status(503).send({ error: 'INTERNAL_SCAN_TOKEN não configurado neste ambiente' });
  }
  const token = request.headers['x-internal-token'];
  if (token !== env.INTERNAL_SCAN_TOKEN) {
    return reply.status(401).send({ error: 'Token interno inválido ou ausente' });
  }
}
