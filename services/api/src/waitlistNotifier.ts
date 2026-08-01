import { env } from './env.js';

/**
 * Aviso interno de novo cadastro na landing de espera — ver
 * _local-adr-policy-004. Não é o outbox de NotificationLog do produto
 * (isso é pra usuário final); é um e-mail direto pra caixa que o dono
 * do produto lê de verdade, mesmo padrão de chamada fina via fetch do
 * services/publisher/src/resendClient.ts. Sem RESEND_API_KEY, é no-op
 * (só loga) — nunca falha a resposta do cadastro por causa disso.
 */
export async function notifyWaitlistSignup(email: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[api] RESEND_API_KEY ausente — aviso de cadastro na waitlist não enviado (no-op): ${email}`);
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FlySpot <alertas@flyspot.com.br>',
        to: [env.WAITLIST_NOTIFICATION_EMAIL],
        subject: 'Novo cadastro na landing de espera do FlySpot',
        html: `<p>Novo e-mail cadastrado na landing de espera (flyspot.com.br):</p><p><strong>${email}</strong></p>`,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[api] Falha ao notificar cadastro na waitlist (Resend respondeu ${response.status}): ${body}`);
    }
  } catch (error) {
    console.error('[api] Erro ao notificar cadastro na waitlist:', error);
  }
}
