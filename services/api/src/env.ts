import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  FIREBASE_PROJECT_ID: z.string().min(1).default('lista-ai-f2916'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  APP_URL: z.string().url().optional(),
  // Segredo compartilhado com services/generator para autenticar chamadas
  // de serviço-a-serviço na rota /internal/scan/:id (sem token de usuário
  // Firebase, já que quem chama é o loop de polling, não um usuário
  // logado). Ver _local-adr-policy-002.
  INTERNAL_SCAN_TOKEN: z.string().min(16).optional(),
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
