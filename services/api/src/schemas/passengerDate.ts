import { z } from 'zod';

/**
 * Forma compartilhada de rota/datas/passageiros, usada tanto por
 * POST /api/monitors quanto por GET /api/route-stats — evita duplicar
 * a validação de passageiros e dos dois modos de busca entre as duas
 * rotas. Ver _local-adr-policy-001 (data).
 *
 * Dois modos, discriminados por `searchMode`:
 * - `dated`: datas obrigatórias, cada uma com flexibilidade assimétrica
 *   (dias antes / dias depois, independentes).
 * - `anytime`: nenhuma data — nem os campos de flexibilidade — é aceita.
 */
const passengerFields = {
  origin: z.string().min(3).max(4),
  destination: z.string().min(3).max(4),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
  infants: z.coerce.number().int().min(0).default(0),
};

const datedFields = {
  searchMode: z.literal('dated'),
  departureDate: z.string().min(1),
  departDaysBefore: z.coerce.number().int().min(0).max(15).optional(),
  departDaysAfter: z.coerce.number().int().min(0).max(15).optional(),
  returnDate: z.string().min(1),
  returnDaysBefore: z.coerce.number().int().min(0).max(15).optional(),
  returnDaysAfter: z.coerce.number().int().min(0).max(15).optional(),
};

const anytimeFields = {
  searchMode: z.literal('anytime'),
};

export function passengerDateUnion<T extends z.ZodRawShape>(extra: T) {
  return z.discriminatedUnion('searchMode', [
    z.object({ ...passengerFields, ...datedFields, ...extra }),
    z.object({ ...passengerFields, ...anytimeFields, ...extra }).strict(),
  ]);
}

export const passengerDateSchema = passengerDateUnion({});

export type PassengerDateInput = z.infer<typeof passengerDateSchema>;
