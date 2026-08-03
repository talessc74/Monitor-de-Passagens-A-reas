import type { FastifyRequest, FastifyReply } from 'fastify';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.js';

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

/**
 * Fonte única da allowlist ADMIN_EMAILS — usada tanto por `requireAdmin`
 * (gate das rotas /api/admin/*) quanto pelo bootstrap em account.ts (que
 * marca isAdmin:true no próprio perfil de quem está na allowlist, sem
 * depender de outro admin já existir pra conceder o primeiro acesso).
 * Ver _local-adr-policy-002 (controls).
 */
export function isAdminEmail(email: string | null): boolean {
  if (!email) return false;
  const allowlist = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

/**
 * Encadeado depois de `authenticate` (precisa de `request.userEmail` já
 * resolvido). Allowlist por e-mail via env, nunca por um campo que o
 * cliente controla.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!isAdminEmail(request.userEmail)) {
    return reply.status(403).send({ error: 'Acesso restrito a administradores' });
  }
}
