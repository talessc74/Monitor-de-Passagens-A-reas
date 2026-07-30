import { z } from 'zod';

/**
 * Forma compartilhada de rota/datas/passageiros, usada tanto por
 * POST /api/monitors quanto por GET /api/route-stats — evita duplicar
 * a validação de passageiros e flexibilidade de datas entre as duas
 * rotas. Ver _local-adr-policy-001 (data).
 */
export const passengerDateSchema = z.object({
  origin: z.string().min(3).max(4),
  destination: z.string().min(3).max(4),
  departureDate: z.string().min(1),
  departFlexDays: z.coerce.number().int().min(0).max(7).optional(),
  returnDate: z.string().min(1),
  returnFlexDays: z.coerce.number().int().min(0).max(7).optional(),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  infants: z.coerce.number().int().min(0).default(0),
});

export type PassengerDateInput = z.infer<typeof passengerDateSchema>;
