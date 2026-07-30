import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8082),
  FIREBASE_PROJECT_ID: z.string().min(1).default('lista-ai-f2916'),
  // Resend: sem a key, o envio é um no-op que loga em vez de lançar —
  // mesmo padrão de fallback do GEMINI_API_KEY. Ver _local-adr-policy-002.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('FlySpot <alertas@flyspot.com.br>'),
  // URL pública do api — usada para montar o link de "pausar monitor"
  // no e-mail (GET /api/monitors/:id/pause?token=...).
  API_PUBLIC_URL: z.string().url().default('http://localhost:8080'),
  // Mesmo segredo do api — assina o token do link de pausar. Ver
  // _local-edr-policy-004.
  EMAIL_ACTION_SECRET: z.string().min(16),
  PAUSE_LINK_TTL_DAYS: z.coerce.number().positive().default(30),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  MAX_SEND_ATTEMPTS: z.coerce.number().int().positive().default(5),
  SENDING_LEASE_MS: z.coerce.number().int().positive().default(120_000),
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
