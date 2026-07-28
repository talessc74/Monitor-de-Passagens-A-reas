import type { FastifyInstance } from 'fastify';
import { listNotifications, clearNotifications } from '../repositories/notificationsRepository.js';

export async function notificationsRoutes(app: FastifyInstance) {
  app.get('/api/notifications', async () => {
    return listNotifications();
  });

  app.delete('/api/notifications', async () => {
    await clearNotifications();
    return { success: true };
  });
}
