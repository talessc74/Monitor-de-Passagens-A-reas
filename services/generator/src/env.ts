import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8081),
  FIREBASE_PROJECT_ID: z.string().min(1).default('lista-ai-f2916'),
  // URL do serviço api e o segredo compartilhado da rota /internal/scan/:id.
  // Ver _local-adr-policy-002.
  API_INTERNAL_URL: z.string().url().default('http://localhost:8080'),
  INTERNAL_SCAN_TOKEN: z.string().min(16),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  MAX_CONCURRENT_SCANS: z.coerce.number().int().positive().default(5),
  LEASE_DURATION_MS: z.coerce.number().int().positive().default(120_000),
  FREE_SCAN_INTERVAL_HOURS: z.coerce.number().positive().default(6),
  PRO_SCAN_INTERVAL_HOURS: z.coerce.number().positive().default(1),
  // Expurgo de histórico por plano (Fase 6) — roda uma vez por dia por
  // padrão. Ver _local-adr-policy-003.
  PURGE_INTERVAL_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Configuração de ambiente inválida:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
