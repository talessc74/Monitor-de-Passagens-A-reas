import type { FastifyInstance } from 'fastify';
import { authenticate } from '../auth.js';
import { ensureUser, deleteUser } from '../repositories/usersRepository.js';
import { deleteAllMonitorsForUser } from '../repositories/monitorsRepository.js';
import { deleteAllNotificationsForUser } from '../repositories/notificationsRepository.js';

export async function accountRoutes(app: FastifyInstance) {
  // Cria o perfil do usuário no primeiro login (idempotente) e o retorna.
  app.get('/api/me', { preHandler: authenticate }, async (request) => {
    return ensureUser(request.userId, request.userEmail, null);
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
