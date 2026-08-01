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
  // Segredo compartilhado com services/publisher para assinar/verificar
  // o link de "pausar monitor" sem login, embutido no e-mail. Distinto
  // do INTERNAL_SCAN_TOKEN — protegem coisas diferentes. Ver
  // _local-edr-policy-004.
  EMAIL_ACTION_SECRET: z.string().min(16).optional(),
  PAUSE_LINK_TTL_DAYS: z.coerce.number().positive().default(30),
  // Stripe (Fase 6) — opcionais: sem eles, as rotas de billing e o
  // webhook ficam desabilitadas (503) em vez de derrubar o boot. Ver
  // _local-adr-policy-003.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_PRO: z.string().optional(),
  // Aviso interno (não é o outbox de notificação do produto) de novo
  // cadastro na landing de espera — ver _local-adr-policy-004. Sem a
  // key, é no-op (mesmo padrão do publisher). Distinto do EMAIL_FROM do
  // publisher: este remetente é fixo (alertas@), aqui é configurável
  // porque é uma caixa que alguém lê de verdade, não um alerta em massa.
  RESEND_API_KEY: z.string().optional(),
  WAITLIST_NOTIFICATION_EMAIL: z.string().email().default('contato@flyspot.com.br'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * O Cloud Run/GitHub Actions injeta `env_vars` de secrets não configurados
 * como string vazia, não como variável ausente — o que quebraria qualquer
 * campo `.optional()` combinado com um validador adicional (`.url()`,
 * `.min()`), derrubando o boot por um segredo que deveria ser
 * legitimamente opcional. Normaliza string vazia para `undefined` antes
 * do parse para que `.optional()` signifique o que diz.
 */
function loadEnv(): Env {
  const sanitized = Object.fromEntries(Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]));
  const parsed = envSchema.safeParse(sanitized);
  if (!parsed.success) {
    console.error('Configuração de ambiente inválida:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
