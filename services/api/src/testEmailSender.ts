import { env } from './env.js';

/**
 * Identidade visual herdada do redesign do site (mesma paleta e
 * tipografia de `services/publisher/src/templates.ts`) — este botão de
 * teste não está preso a um monitor real, então não tem o cartão de
 * embarque nem o link de pausar, só o cabeçalho/corpo com a mesma cara.
 * Cores fixas no modo claro e tabelas em vez de flex/grid pela mesma
 * razão de compatibilidade de clientes de e-mail.
 */
function styledTestEmail(subject: string, content: string): string {
  const paperDeep = '#f0e9dc';
  const paperCard = '#fffdf9';
  const ink = '#2a241d';
  const border = '#e4ddd0';
  const terracotta = '#b5502f';
  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;">
        <div style="background:${paperDeep};padding:32px 16px;font-family:${sans};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td align="center">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:${paperCard};border:1px solid ${border};border-radius:12px;">
                  <tr>
                    <td style="padding:24px 28px 0;">
                      <div style="font-family:${serif};font-size:19px;font-weight:600;color:${ink};">
                        Fly<span style="font-style:italic;color:${terracotta};">Spot</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 28px 28px;">
                      <h1 style="font-family:${serif};font-size:18px;font-weight:600;color:${ink};margin:0 0 10px;">${subject}</h1>
                      <p style="font-size:14px;line-height:1.6;color:${ink};margin:0;">${content}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
}

/**
 * Envio real via Resend para o botão de teste do dashboard
 * (`/api/test-email`) — mesmo padrão de chamada fina via fetch do
 * waitlistNotifier.ts e do publisher/src/resendClient.ts. Sem
 * RESEND_API_KEY, `sent` volta `false` sem erro (é o estado esperado em
 * dev/preview, não uma falha) — quem chama decide como comunicar isso.
 */
export async function sendRealTestEmail(params: { to: string; subject: string; content: string }): Promise<{ sent: boolean; error?: string }> {
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
        html: styledTestEmail(params.subject, params.content),
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
