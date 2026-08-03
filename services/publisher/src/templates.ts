import type { NotificationLog } from '@mpa/types';
import { buildPauseUrl } from './pauseLink.js';

/**
 * Templates HTML dos três tipos de e-mail (Fase 5). Espelha de propósito
 * o preview visual que já existia no dashboard (`EmailModal.tsx`) — até
 * então esse preview era só um mockup próprio, sem nenhuma relação com o
 * HTML de verdade enviado via Resend, o que gerava a inconsistência de
 * "o e-mail que chega não parece em nada com o preview do site". Cores
 * fixas no modo claro (não `prefers-color-scheme`): clientes de e-mail
 * não suportam isso de forma confiável. Tabelas em vez de flex/grid pela
 * mesma razão de compatibilidade. O link de "pausar monitor" funciona
 * sem login — ver _local-edr-policy-004.
 */

const COLORS = {
  paperDeep: '#f0e9dc',
  paperCard: '#fffdf9',
  ink: '#2a241d',
  inkMuted: '#6b6255',
  terracotta: '#b5502f',
  terracottaHover: '#9a3f23',
  teal: '#0f6b5c',
  tealWash: '#e3f0ec',
  border: '#e4ddd0',
};

const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

interface EmailCopy {
  badge: string;
  eyebrow: string;
  headline: string;
  buttonLabel: string;
  showPricePill: boolean;
}

function priceText(notification: NotificationLog): string {
  return notification.price > 0 ? `R$ ${notification.price}` : 'Simulado';
}

function card(notification: NotificationLog, copy: EmailCopy): string {
  const priceLabel = priceText(notification);
  const targetLabel = notification.targetPrice > 0 ? `R$ ${notification.targetPrice}` : '---';

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:${COLORS.paperCard};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:${COLORS.terracotta};padding:18px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family:${SANS};font-size:14px;font-weight:800;letter-spacing:.04em;color:#ffffff;">✈ FLYSPOT</td>
              <td align="right">
                <span style="display:inline-block;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);border-radius:6px;padding:4px 10px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ffffff;">${copy.badge}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding-bottom:${copy.showPricePill ? '18' : '4'}px;">
                <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.inkMuted};">${copy.eyebrow}</div>
                <div style="font-family:${SERIF};font-size:20px;font-weight:700;color:${COLORS.ink};margin-top:6px;">${copy.headline}</div>
                ${
                  copy.showPricePill
                    ? `
                <div style="display:inline-block;margin-top:14px;border:1px solid ${COLORS.teal};background:${COLORS.tealWash};border-radius:10px;padding:10px 22px;">
                  <span style="font-family:${MONO};font-size:24px;font-weight:800;color:${COLORS.teal};">${priceLabel}</span>
                </div>
                <div style="font-family:${SANS};font-size:11px;color:${COLORS.inkMuted};margin-top:8px;">Preço teto configurado: <strong style="color:${COLORS.ink};">${targetLabel}</strong></div>
                `
                    : ''
                }
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid ${COLORS.border};background:${COLORS.paperDeep};border-radius:10px;">
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid ${COLORS.border};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:${SANS};font-size:11px;font-weight:700;color:${COLORS.inkMuted};">Rota Monitorada</td>
                    <td align="right" style="font-family:${MONO};font-size:14px;font-weight:800;color:${COLORS.ink};">${notification.origin} ➔ ${notification.destination}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid ${COLORS.border};">
                <p style="font-family:${SANS};font-size:13px;line-height:1.6;color:${COLORS.ink};margin:0;">${notification.message}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:${SANS};font-size:10px;color:${COLORS.inkMuted};">Varredura automática</td>
                    <td align="right" style="font-family:${SANS};font-size:10px;font-weight:700;color:${COLORS.teal};">● Preço confirmado</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          ${
            notification.purchaseUrl
              ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
            <tr>
              <td align="center">
                <a href="${notification.purchaseUrl}" style="display:block;background:${COLORS.terracotta};color:#ffffff;font-family:${SANS};font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;border-radius:10px;padding:14px 20px;">
                  ${copy.buttonLabel} (${priceLabel})
                </a>
              </td>
            </tr>
          </table>
          `
              : ''
          }
        </td>
      </tr>
      <tr>
        <td style="background:${COLORS.paperDeep};border-top:1px solid ${COLORS.border};padding:16px 24px;">
          <p style="font-family:${SANS};font-size:10px;color:${COLORS.inkMuted};margin:0 0 4px;text-align:center;">© 2026 FlySpot. Todos os direitos reservados.</p>
          <p style="font-family:${SANS};font-size:10px;color:${COLORS.inkMuted};margin:0;text-align:center;">Você recebeu este aviso porque cadastrou um alerta ativo correspondente ao e-mail: ${notification.sentTo}</p>
        </td>
      </tr>
    </table>
  `;
}

function layout(notification: NotificationLog, subject: string, copy: EmailCopy): string {
  const pauseUrl = buildPauseUrl(notification.monitorId);
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;">
        <div style="background:${COLORS.paperDeep};padding:32px 16px;font-family:${SANS};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td align="center">
                ${card(notification, copy)}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
                  <tr>
                    <td style="padding:16px 24px 0;">
                      <p style="font-family:${SANS};font-size:11px;color:${COLORS.inkMuted};margin:0;text-align:center;">
                        Não quer mais receber alertas deste monitor?
                        <a href="${pauseUrl}" style="color:${COLORS.terracotta};font-weight:600;">Pausar monitor</a>.
                      </p>
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

export function targetReachedEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Meta atingida: ${notification.origin} → ${notification.destination} por R$ ${notification.price}`;
  const html = layout(notification, subject, {
    badge: 'Alerta Imediato',
    eyebrow: 'Meta Atingida',
    headline: 'Sua passagem está com preço ideal!',
    buttonLabel: 'Ir para o site de compra e reservar',
    showPricePill: true,
  });
  return { subject, html };
}

export function priceInRangeEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Preço na faixa de aviso: ${notification.origin} → ${notification.destination} por R$ ${notification.price}`;
  const html = layout(notification, subject, {
    badge: 'Faixa de Aviso',
    eyebrow: 'Perto da meta',
    headline: 'O preço entrou na sua faixa de aviso',
    buttonLabel: 'Ir para o site de compra e reservar',
    showPricePill: true,
  });
  return { subject, html };
}

export function priceUpdateEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Preço atualizado: ${notification.origin} → ${notification.destination}`;
  const html = layout(notification, subject, {
    badge: 'Atualização',
    eyebrow: 'Preço Atualizado',
    headline: 'O preço do seu monitor mudou',
    buttonLabel: 'Ver detalhes',
    showPricePill: true,
  });
  return { subject, html };
}
