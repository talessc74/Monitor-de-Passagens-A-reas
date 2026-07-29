import type { FastifyInstance } from 'fastify';
import { listNotificationsForUser, deleteAllNotificationsForUser } from '../repositories/notificationsRepository.js';
import { authenticate } from '../auth.js';

export async function notificationsRoutes(app: FastifyInstance) {
  app.get('/api/notifications', { preHandler: authenticate }, async (request) => {
    return listNotificationsForUser(request.userId);
  });

  app.delete('/api/notifications', { preHandler: authenticate }, async (request) => {
    await deleteAllNotificationsForUser(request.userId);
    return { success: true };
  });
}
