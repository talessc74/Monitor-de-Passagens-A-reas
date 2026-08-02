import { env } from './env.js';

/**
 * Envio real via Resend para o botão de teste do dashboard
 * (`/api/test-email`) — mesmo padrão de chamada fina via fetch do
 * waitlistNotifier.ts e do publisher/src/resendClient.ts. Sem
 * RESEND_API_KEY, `sent` volta `false` sem erro (é o estado esperado em
 * dev/preview, não uma falha) — quem chama decide como comunicar isso.
 */
export async function sendRealTestEmail(params: { to: string; subject: string; html: string }): Promise<{ sent: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    return { sent: false };
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
        to: [params.to],
        subject: params.subject,
        html: params.html,
        // alertas@ não tem inbox real — ver resendClient.ts do publisher.
        reply_to: 'contato@flyspot.com.br',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { sent: false, error: `Resend respondeu ${response.status}: ${body}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}
