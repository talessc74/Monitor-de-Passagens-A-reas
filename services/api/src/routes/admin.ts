import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../auth.js';
import { getUserByEmail, updateUser } from '../repositories/usersRepository.js';

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
}
