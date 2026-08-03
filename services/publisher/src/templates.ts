import type { NotificationLog } from '@mpa/types';
import { buildPauseUrl } from './pauseLink.js';

/**
 * Templates HTML dos três tipos de e-mail (Fase 5). Identidade visual
 * herdada do redesign do site (motivo de cartão de embarque, paleta
 * editorial quente) — ver `apps/web/src/app/globals.css` pras variáveis
 * de cor originais. Cores fixas no modo claro (não `prefers-color-scheme`):
 * clientes de e-mail não suportam isso de forma confiável, e um e-mail
 * escuro-por-engano é pior que um e-mail sempre claro. Tabelas em vez de
 * flex/grid pela mesma razão de compatibilidade. O link de "pausar
 * monitor" funciona sem login — ver _local-edr-policy-004.
 */

const COLORS = {
  paperDeep: '#f0e9dc',
  paperCard: '#fffdf9',
  ink: '#2a241d',
  inkMuted: '#6b6255',
  terracotta: '#b5502f',
  teal: '#0f6b5c',
  border: '#e4ddd0',
  borderStrong: '#c9bfa9',
};

const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function ticket(notification: NotificationLog, accent: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paperDeep};border:1px dashed ${COLORS.borderStrong};border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-family:${MONO};font-size:26px;font-weight:700;color:${COLORS.ink};">${notification.origin}</td>
              <td align="right" style="font-family:${MONO};font-size:26px;font-weight:700;color:${COLORS.ink};">${notification.destination}</td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px dashed ${COLORS.borderStrong};">
            <tr>
              <td style="padding-top:14px;">
                <div style="font-family:${SANS};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${COLORS.inkMuted};">Preço encontrado</div>
                <div style="font-family:${MONO};font-size:20px;font-weight:800;color:${accent};margin-top:2px;">R$ ${notification.price}</div>
              </td>
              <td align="right" style="padding-top:14px;">
                <div style="font-family:${SANS};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${COLORS.inkMuted};">Meta</div>
                <div style="font-family:${MONO};font-size:14px;font-weight:700;color:${COLORS.inkMuted};margin-top:2px;">R$ ${notification.targetPrice}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function layout(notification: NotificationLog, title: string, accent: string, extraBody: string): string {
  const pauseUrl = buildPauseUrl(notification.monitorId);
  return `
    <div style="background:${COLORS.paperDeep};padding:32px 16px;font-family:${SANS};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:${COLORS.paperCard};border:1px solid ${COLORS.border};border-radius:12px;">
              <tr>
                <td style="padding:24px 28px 0;">
                  <div style="font-family:${SERIF};font-size:19px;font-weight:600;color:${COLORS.ink};">
                    Fly<span style="font-style:italic;color:${COLORS.terracotta};">Spot</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 28px 0;">
                  <h1 style="font-family:${SERIF};font-size:18px;font-weight:600;color:${COLORS.ink};margin:0 0 10px;">${title}</h1>
                  <p style="font-size:14px;line-height:1.6;color:${COLORS.ink};margin:0 0 18px;">${notification.message}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px;">${ticket(notification, accent)}</td>
              </tr>
              <tr>
                <td style="padding:20px 28px 4px;">${extraBody}</td>
              </tr>
              <tr>
                <td style="padding:8px 28px 24px;">
                  <div style="border-top:1px solid ${COLORS.border};margin:8px 0 16px;"></div>
                  <p style="font-size:11px;color:${COLORS.inkMuted};margin:0;">
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
  `;
}

function purchaseButton(purchaseUrl: string | undefined, label: string): string {
  if (!purchaseUrl) return '';
  return `<a href="${purchaseUrl}" style="display:inline-block;background:${COLORS.terracotta};color:#fffdf9;font-weight:700;font-size:13px;padding:10px 18px;border-radius:8px;text-decoration:none;">${label} →</a>`;
}

export function targetReachedEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Meta atingida: ${notification.origin} → ${notification.destination} por R$ ${notification.price}`;
  const html = layout(notification, 'Sua meta de preço foi atingida! 🎉', COLORS.teal, purchaseButton(notification.purchaseUrl, 'Ver e comprar'));
  return { subject, html };
}

export function priceInRangeEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Preço na faixa de aviso: ${notification.origin} → ${notification.destination} por R$ ${notification.price}`;
  const html = layout(notification, 'O preço entrou na sua faixa de aviso', COLORS.terracotta, purchaseButton(notification.purchaseUrl, 'Ver e comprar'));
  return { subject, html };
}

export function priceUpdateEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Preço atualizado: ${notification.origin} → ${notification.destination}`;
  const html = layout(notification, 'O preço do seu monitor mudou', COLORS.terracotta, purchaseButton(notification.purchaseUrl, 'Ver detalhes'));
  return { subject, html };
}
