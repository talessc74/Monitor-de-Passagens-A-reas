import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8083),
  // Mesmo segredo do services/api e services/generator — reaproveitado
  // aqui em vez de criar um terceiro token, mesmo propósito (autenticar
  // chamada de serviço-a-serviço, sem usuário Firebase). Ver
  // _local-adr-policy-002.
  INTERNAL_SCAN_TOKEN: z.string().min(16),
  // Teto de segurança pro navegador headless — nunca deixa uma busca
  // travada seguntar o processo indefinidamente. Ver _local-bdr-policy-015.
  SCRAPE_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
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
