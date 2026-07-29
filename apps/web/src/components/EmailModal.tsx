'use client';

import { useState } from 'react';
import { X, Plane, Copy, Check, ExternalLink } from 'lucide-react';
import type { NotificationLog } from '@mpa/types';

interface EmailModalProps {
  notification: NotificationLog | null;
  onClose: () => void;
}

export default function EmailModal({ notification, onClose }: EmailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!notification) return null;

  const purchaseUrl = notification.purchaseUrl ?? '#';

  const handleCopy = () => {
    navigator.clipboard.writeText(purchaseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" id="email-preview-modal">
      <div className="w-full max-w-2xl bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-800 text-white flex flex-col max-h-[90vh]">
        <div className="bg-zinc-950 px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span className="text-xs font-mono text-zinc-500 ml-2">FlySpot_Email_Preview</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="bg-zinc-900 p-4 border-b border-zinc-800 space-y-2 text-xs">
          <div className="flex">
            <span className="w-16 font-bold text-zinc-500">De:</span>
            <span className="text-blue-400 font-bold flex items-center gap-1">
              alertas@flyspot.com.br <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.2 rounded text-[9px] border border-blue-500/20">Robô Verificado</span>
            </span>
          </div>
          <div className="flex">
            <span className="w-16 font-bold text-zinc-500">Para:</span>
            <span className="text-zinc-200">{notification.sentTo}</span>
          </div>
          <div className="flex">
            <span className="w-16 font-bold text-zinc-500">Assunto:</span>
            <span className="text-white font-extrabold">{notification.title}</span>
          </div>
          <div className="flex">
            <span className="w-16 font-bold text-zinc-500">Data:</span>
            <span className="text-zinc-400">{new Date(notification.sentAt).toLocaleString('pt-BR')}</span>
          </div>
        </div>

        <div className="bg-white text-zinc-800 p-8 overflow-y-auto flex-1 font-sans">
          <div className="mx-auto max-w-xl border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-blue-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="h-5 w-5 transform rotate-45" />
                <span className="font-extrabold tracking-tight text-sm">FLYSPOT</span>
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase border border-white/20 px-2 py-0.5 rounded bg-white/10">
                Alerta Imediato
              </span>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Metas Atingidas</p>
                <h3 className="text-xl font-black text-slate-950 leading-tight">Sua passagem está com preço ideal!</h3>
                <div className="mt-3 inline-flex items-center gap-3 bg-emerald-50 text-emerald-800 font-black text-2xl px-5 py-2.5 rounded-2xl border border-emerald-100 shadow-sm">
                  R$ {notification.price > 0 ? notification.price : 'Simulado'}
                </div>
                <p className="text-[11px] text-slate-500">
                  Preço teto configurado: <strong className="text-slate-700">R$ {notification.targetPrice > 0 ? notification.targetPrice : '---'}</strong>
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 text-xs text-slate-700">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-semibold text-slate-400">Rota Monitorada</span>
                  <span className="font-extrabold text-slate-950 font-mono">
                    {notification.origin} ➔ {notification.destination}
                  </span>
                </div>
                <div>
                  <p className="text-slate-600 mb-1 leading-relaxed font-medium">{notification.message}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Varredura automática</span>
                  <span className="text-emerald-600 font-bold">● Preço Confirmado</span>
                </div>
              </div>

              <div className="text-center space-y-3 pt-2">
                <a
                  href={purchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full text-center rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-xs font-bold text-white transition shadow-md shadow-blue-100/50 uppercase tracking-wider"
                  id="btn-buy-flight-direct"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ir para o Site de Compra & Reservar (R$ {notification.price > 0 ? notification.price : 'Simulado'})
                </a>

                <div className="rounded-xl bg-slate-50 border border-slate-150 p-3 text-left space-y-1.5">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Link Direto Dedicado (Pré-preenchido)</span>
                  <div className="flex items-center gap-2">
                    <input type="text" readOnly value={purchaseUrl} className="flex-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-mono text-slate-600 focus:outline-none" />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded transition whitespace-nowrap"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 leading-normal text-left">
                  Este link direciona você de forma automática para o canal oficial com os parâmetros de aeroportos, datas e passageiros já preenchidos.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 p-4 text-center text-[9px] text-slate-400 space-y-1">
              <p className="font-bold">© 2026 FlySpot. Todos os direitos reservados.</p>
              <p>Você recebeu este aviso porque cadastrou um alerta ativo correspondente ao e-mail: {notification.sentTo}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
