import type { NotificationLog } from '@mpa/types';
import { buildPauseUrl } from './pauseLink.js';

/**
 * Templates HTML dos dois tipos de e-mail (Fase 5). O link de "pausar
 * monitor" funciona sem login — ver _local-edr-policy-004.
 */

function layout(monitorId: string, title: string, bodyHtml: string): string {
  const pauseUrl = buildPauseUrl(monitorId);
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px;">${title}</h1>
      ${bodyHtml}
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e5e5;" />
      <p style="font-size: 12px; color: #666;">
        Não quer mais receber alertas deste monitor?
        <a href="${pauseUrl}">Pausar monitor</a>.
      </p>
    </div>
  `;
}

export function targetReachedEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Meta atingida: ${notification.origin} → ${notification.destination} por R$ ${notification.price}`;
  const body = `
    <p>${notification.message}</p>
    <p><strong>Preço encontrado: R$ ${notification.price}</strong> (meta: R$ ${notification.targetPrice})</p>
    ${notification.purchaseUrl ? `<p><a href="${notification.purchaseUrl}">Ver e comprar</a></p>` : ''}
  `;
  return { subject, html: layout(notification.monitorId, 'Sua meta de preço foi atingida! 🎉', body) };
}

export function priceInRangeEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Preço na faixa de aviso: ${notification.origin} → ${notification.destination} por R$ ${notification.price}`;
  const body = `
    <p>${notification.message}</p>
    <p><strong>Preço encontrado: R$ ${notification.price}</strong> (meta: R$ ${notification.targetPrice})</p>
    ${notification.purchaseUrl ? `<p><a href="${notification.purchaseUrl}">Ver e comprar</a></p>` : ''}
  `;
  return { subject, html: layout(notification.monitorId, 'O preço entrou na sua faixa de aviso', body) };
}

export function priceUpdateEmail(notification: NotificationLog): { subject: string; html: string } {
  const subject = `Preço atualizado: ${notification.origin} → ${notification.destination}`;
  const body = `
    <p>${notification.message}</p>
    <p><strong>Novo preço: R$ ${notification.price}</strong> (meta: R$ ${notification.targetPrice})</p>
    ${notification.purchaseUrl ? `<p><a href="${notification.purchaseUrl}">Ver detalhes</a></p>` : ''}
  `;
  return { subject, html: layout(notification.monitorId, 'O preço do seu monitor mudou', body) };
}
