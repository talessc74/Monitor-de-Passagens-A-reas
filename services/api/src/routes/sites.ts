import type { FastifyInstance } from 'fastify';
import { listSites, getSite, patchSite } from '../repositories/sitesRepository.js';

export async function sitesRoutes(app: FastifyInstance) {
  app.get('/api/sites', async () => {
    return listSites();
  });

  app.post<{ Params: { id: string } }>('/api/sites/:id/toggle', async (request, reply) => {
    const site = await getSite(request.params.id);
    if (!site) {
      return reply.status(404).send({ error: 'Site não encontrado' });
    }
    const newStatus = site.status === 'active' ? 'maintenance' : 'active';
    await patchSite(site.id, { status: newStatus });
    return { success: true, site: { ...site, status: newStatus } };
  });
}
