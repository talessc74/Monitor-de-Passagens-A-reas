import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from 'firebase-admin/auth';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string | null;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Token de autenticação ausente' });
  }

  const token = header.slice('Bearer '.length);

  try {
    const decoded = await getAuth().verifyIdToken(token);
    request.userId = decoded.uid;
    request.userEmail = decoded.email ?? null;
  } catch (error) {
    request.log.warn({ err: error }, 'Falha ao verificar token Firebase');
    return reply.status(401).send({ error: 'Token inválido ou expirado' });
  }
}
