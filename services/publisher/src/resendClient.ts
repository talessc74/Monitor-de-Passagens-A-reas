import { env } from './env.js';

/**
 * Cliente fino via fetch para a API REST do Resend — evita adicionar o
 * pacote `resend` como dependência nova. Sem RESEND_API_KEY, o envio é
 * um no-op que só loga (mesmo padrão de fallback do GEMINI_API_KEY em
 * services/api/src/geminiClient.ts). Ver _local-adr-policy-002.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[publisher] RESEND_API_KEY ausente — e-mail não enviado (no-op): to=${params.to} subject="${params.subject}"`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      // alertas@ (EMAIL_FROM) não tem caixa de entrada de verdade — só o
      // MX de bounce do Resend está configurado no DNS, não recebimento
      // real. Sem reply_to, "Responder" iria para alertas@ e falharia
      // silenciosamente (bounce). contato@ é a caixa que existe de fato.
      reply_to: env.EMAIL_REPLY_TO,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend respondeu ${response.status}: ${body}`);
  }
}
