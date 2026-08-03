import type { FastifyInstance } from 'fastify';
import { authenticate, isAdminEmail } from '../auth.js';
import { ensureUser, deleteUser, updateUser } from '../repositories/usersRepository.js';
import { deleteAllMonitorsForUser } from '../repositories/monitorsRepository.js';
import { deleteAllNotificationsForUser } from '../repositories/notificationsRepository.js';

export async function accountRoutes(app: FastifyInstance) {
  // Cria o perfil do usuário no primeiro login (idempotente) e o retorna.
  // Bootstrap de isAdmin: quem está na allowlist ADMIN_EMAILS recebe
  // isAdmin:true no próprio perfil aqui — sem isso, o primeiro admin
  // nunca teria como se conceder acesso (POST /api/admin/grant-access já
  // exige isAdmin/allowlist pra conceder a OUTRA pessoa, não a si
  // mesmo). Idempotente: só grava quando ainda não está true. Ver
  // _local-adr-policy-002 (controls).
  app.get('/api/me', { preHandler: authenticate }, async (request) => {
    const profile = await ensureUser(request.userId, request.userEmail, null);
    if (isAdminEmail(request.userEmail) && !profile.isAdmin) {
      await updateUser(profile.uid, { isAdmin: true });
      return { ...profile, isAdmin: true };
    }
    return profile;
  });

  // Apaga a conta e todos os dados associados (obrigatório pela LGPD).
  app.delete('/api/me', { preHandler: authenticate }, async (request) => {
    await Promise.all([
      deleteAllMonitorsForUser(request.userId),
      deleteAllNotificationsForUser(request.userId),
    ]);
    await deleteUser(request.userId);
    return { success: true };
  });
}
