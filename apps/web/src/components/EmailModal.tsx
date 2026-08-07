'use client';

import { useState } from 'react';
import { X, Plane, Copy, Check, ExternalLink } from 'lucide-react';
import type { NotificationLog } from '@mpa/types';
import { useEscapeToClose } from '../lib/useEscapeToClose';

interface EmailModalProps {
  notification: NotificationLog | null;
  onClose: () => void;
}

export default function EmailModal({ notification, onClose }: EmailModalProps) {
  const [copied, setCopied] = useState(false);
  useEscapeToClose(onClose);

  if (!notification) return null;

  const purchaseUrl = notification.purchaseUrl ?? '#';

  const handleCopy = () => {
    navigator.clipboard.writeText(purchaseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      id="email-preview-modal"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-strong text-paper-on-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Pré-visualização do e-mail"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="ml-2 font-mono text-xs text-paper-on-ink-muted">FlySpot_Email_Preview</span>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-paper-on-ink-muted transition hover:text-paper-on-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-white/10 p-4 text-xs">
          <div className="flex">
            <span className="w-16 font-bold text-paper-on-ink-muted">De:</span>
            <span className="flex items-center gap-1 font-bold text-terracotta-tint">
              alertas@flyspot.com.br <span className="rounded border border-teal/30 bg-teal/10 px-1.5 py-0.5 text-[9px] text-teal">Robô Verificado</span>
            </span>
          </div>
          <div className="flex">
            <span className="w-16 font-bold text-paper-on-ink-muted">Para:</span>
            <span className="text-paper-on-ink">{notification.sentTo}</span>
          </div>
          <div className="flex">
            <span className="w-16 font-bold text-paper-on-ink-muted">Assunto:</span>
            <span className="font-extrabold text-paper-on-ink">{notification.title}</span>
          </div>
          <div className="flex">
            <span className="w-16 font-bold text-paper-on-ink-muted">Data:</span>
            <span className="text-paper-on-ink-muted">{new Date(notification.sentAt).toLocaleString('pt-BR')}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#FAF6EF] p-8 font-sans text-[#2A241D]">
          <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-[#E4DDD0] shadow-sm">
            <div className="flex items-center justify-between bg-[#B5502F] p-5 text-white">
              <div className="flex items-center gap-2">
                <Plane className="h-5 w-5 rotate-45" />
                <span className="text-sm font-extrabold tracking-tight">FLYSPOT</span>
              </div>
              <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                Alerta Imediato
              </span>
            </div>

            <div className="space-y-6 p-6">
              <div className="space-y-2 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B6255]">Meta Atingida</p>
                <h3 className="text-xl font-black leading-tight">Sua passagem está com preço ideal!</h3>
                <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-[#0F6B5C]/20 bg-[#0F6B5C]/10 px-5 py-2.5 text-2xl font-black text-[#0F6B5C]">
                  R$ {notification.price.toLocaleString('pt-BR')}
                </div>
                <p className="text-[11px] text-[#6B6255]">
                  Preço teto configurado: <strong className="text-[#2A241D]">R$ {notification.targetPrice > 0 ? notification.targetPrice : '---'}</strong>
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-[#E4DDD0] bg-[#F0E9DC]/40 p-4 text-xs">
                <div className="flex justify-between border-b border-[#E4DDD0] pb-2">
                  <span className="font-semibold text-[#6B6255]">Rota Monitorada</span>
                  <span className="font-mono font-extrabold">
                    {notification.origin} ➔ {notification.destination}
                  </span>
                </div>
                <div>
                  <p className="mb-1 font-medium leading-relaxed text-[#4A4235]">{notification.message}</p>
                </div>
                <div className="flex items-center justify-between border-t border-[#E4DDD0] pt-2 text-[11px] text-[#6B6255]">
                  <span>Varredura automática</span>
                  <span className="font-bold text-[#0F6B5C]">● Preço confirmado</span>
                </div>
              </div>

              <div className="space-y-3 pt-2 text-center">
                <a
                  href={purchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B5502F] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-[#9A3F23]"
                  id="btn-buy-flight-direct"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ir para o site de compra e reservar (R$ {notification.price.toLocaleString('pt-BR')})
                </a>

                <div className="space-y-1.5 rounded-xl border border-[#E4DDD0] bg-[#F0E9DC]/40 p-3 text-left">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-[#6B6255]">Link direto dedicado (pré-preenchido)</span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="email-purchase-link" className="sr-only">Link direto de compra</label>
                    <input
                      id="email-purchase-link"
                      type="text"
                      readOnly
                      value={purchaseUrl}
                      className="flex-1 rounded border border-[#E4DDD0] bg-white px-2.5 py-1.5 font-mono text-[10px] text-[#4A4235] focus:outline-none focus:ring-1 focus:ring-[#B5502F]"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 whitespace-nowrap rounded border border-[#E4DDD0] bg-[#F0E9DC] px-3 py-1.5 text-[10px] font-bold text-[#B5502F] transition hover:bg-[#E4DDD0]"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-[#0F6B5C]" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <p className="text-left text-[9px] leading-normal text-[#6B6255]">
                  Este link direciona você de forma automática para o canal oficial com os parâmetros de aeroportos, datas e passageiros já preenchidos.
                </p>
              </div>
            </div>

            <div className="space-y-1 border-t border-[#E4DDD0] bg-[#F0E9DC]/40 p-4 text-center text-[9px] text-[#6B6255]">
              <p className="font-bold">© 2026 FlySpot. Todos os direitos reservados.</p>
              <p>Você recebeu este aviso porque cadastrou um alerta ativo correspondente ao e-mail: {notification.sentTo}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
