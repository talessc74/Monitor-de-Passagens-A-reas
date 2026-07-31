import { z } from 'zod';
import { MIN_CONNECTION_HOURS } from '../itinerarySearch.js';

/**
 * Fase 9 ("Itinerários") — ver _local-bdr-plan-003. Extraído de
 * routes/itineraries.ts pra ser testável isoladamente, sem precisar
 * subir o Fastify inteiro — achado da Galera de QA (SCAFFOLD) na
 * deliberação de 2026-07-31: "teste de validação não deveria depender
 * de infraestrutura HTTP".
 */
export const createItinerarySchema = z
  .object({
    origin: z.string().min(3).max(4),
    finalDestination: z.string().min(3).max(4),
    maxLegs: z.coerce.number().int().min(1).max(4).default(4),
    maxLayoverHours: z.coerce.number().min(1).max(24).default(6),
    allowOvernightLayovers: z.boolean().default(false),
    dateWindowStart: z.string(),
    dateWindowEnd: z.string(),
    targetPrice: z.coerce.number().positive(),
    adults: z.coerce.number().int().min(1).default(1),
    children: z.coerce.number().int().min(0).default(0),
    email: z.string().email(),
    // Reconhecimento explícito do LIABILITY_DISCLAIMER — não é um
    // checkbox pré-marcado nem um texto de rodapé ignorável, é campo
    // obrigatório na criação. Decisão do dono do produto (2026-07-31).
    riskAcknowledged: z.literal(true, {
      errorMap: () => ({ message: 'É necessário confirmar que leu o aviso sobre risco de conexão e responsabilidade.' }),
    }),
  })
  .superRefine((data, ctx) => {
    // Sem pernoite habilitado, o teto de conexão do usuário precisa
    // caber acima do mínimo de segurança — senão nenhuma aresta do grafo
    // jamais passaria no filtro de MIN_CONNECTION_HOURS.
    if (!data.allowOvernightLayovers && data.maxLayoverHours < MIN_CONNECTION_HOURS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxLayoverHours'],
        message: `maxLayoverHours precisa ser pelo menos ${MIN_CONNECTION_HOURS}h (mínimo de segurança de conexão) quando pernoite não é permitido.`,
      });
    }
  });
