import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addWaitlistSignup } from '../repositories/waitlistRepository.js';
import { notifyWaitlistSignup } from '../waitlistNotifier.js';

/**
 * Landing de espera (pré-lançamento) — ver _local-adr-policy-004
 * (platform). Rota pública, sem authenticate: quem preenche o formulário
 * não tem conta ainda, é justamente o ponto da landing.
 *
 * Anti-spam: honeypot ("website" — nome plausível pra um bot preencher,
 * invisível pro humano via CSS no frontend) + o rate-limit global do
 * Fastify (index.ts) já cobre o resto, conforme decisão do briefing
 * ("rate limit ou honeypot já é suficiente nessa fase").
 */
// website (honeypot): aceita qualquer valor sem rejeitar no schema —
// se recusássemos aqui, o bot receberia 400 e aprenderia que o campo é
// filtrado. O silêncio acontece no handler (retorna sucesso, não grava).
const waitlistSchema = z.object({
  email: z.string().email(),
  website: z.string().optional(),
});

export async function waitlistRoutes(app: FastifyInstance) {
  app.post('/api/waitlist', async (request, reply) => {
    const parsed = waitlistSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'E-mail inválido' });
    }

    // Honeypot preenchido = bot. Responde sucesso genérico sem gravar
    // nada, pra não dar sinal ao bot de que foi filtrado.
    if (parsed.data.website && parsed.data.website.length > 0) {
      return { success: true };
    }

    const { created } = await addWaitlistSignup(parsed.data.email);
    // Só avisa em cadastro real e novo — reenvio do mesmo e-mail (created:
    // false) não deve gerar um e-mail de aviso repetido pro dono do produto.
    if (created) {
      notifyWaitlistSignup(parsed.data.email).catch(() => {
        /* já logado dentro de notifyWaitlistSignup — não falha o cadastro do usuário por isso */
      });
    }
    return { success: true };
  });
}
