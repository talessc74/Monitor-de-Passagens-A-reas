/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, Plane, Mail, ShieldAlert, BadgeCent, Copy, Check, ExternalLink } from "lucide-react";
import { NotificationLog } from "../types";

interface EmailModalProps {
  notification: NotificationLog | null;
  onClose: () => void;
}

export default function EmailModal({ notification, onClose }: EmailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!notification) return null;

  const getPurchaseUrl = (notif: NotificationLog): string => {
    if (notif.purchaseUrl) {
      return notif.purchaseUrl;
    }

    const msg = notif.message.toLowerCase();
    let site = "skyscanner";
    if (msg.includes("latam")) site = "latam";
    else if (msg.includes("gol")) site = "gol";
    else if (msg.includes("azul")) site = "azul";
    else if (msg.includes("decolar")) site = "decolar";

    let depDate = "2026-10-12";
    let retDate = "2026-10-26";
    let adults = 1;
    let kids = 0;

    const dateRegex = /(\d{4}-\d{2}-\d{2})/g;
    const matches = notif.message.match(dateRegex);
    if (matches && matches.length >= 2) {
      depDate = matches[0];
      retDate = matches[1];
    } else {
      const brDateRegex = /(\d{2}\/\d{2}\/\d{4})/g;
      const brMatches = notif.message.match(brDateRegex);
      if (brMatches && brMatches.length >= 2) {
        const parts1 = brMatches[0].split("/");
        const parts2 = brMatches[1].split("/");
        if (parts1.length === 3 && parts2.length === 3) {
          depDate = `${parts1[2]}-${parts1[1]}-${parts1[0]}`;
          retDate = `${parts2[2]}-${parts2[1]}-${parts2[0]}`;
        }
      }
    }

    const origin = notif.origin || "GRU";
    const dest = notif.destination || "LIS";

    if (site === "latam") {
      return `https://www.latamairlines.com/br/pt/voos?origem=${origin.toUpperCase()}&destino=${dest.toUpperCase()}&saida=${depDate}&volta=${retDate}&adultos=${adults}&criancas=${kids}`;
    } else if (site === "gol") {
      return `https://b2c.voegol.com.br/compra/busca-voos?origin=${origin.toUpperCase()}&destination=${dest.toUpperCase()}&outboundDate=${depDate}&inboundDate=${retDate}&adults=${adults}&children=${kids}`;
    } else if (site === "azul") {
      return `https://www.voeazul.com.br/br/pt/home/selecao-voo?origin=${origin.toUpperCase()}&destination=${dest.toUpperCase()}&departureDate=${depDate}&returnDate=${retDate}&adults=${adults}&children=${kids}`;
    } else if (site === "decolar") {
      return `https://www.decolar.com/shop/flights/search/roundtrip/${origin.toUpperCase()}/${dest.toUpperCase()}/${depDate}/${retDate}/${adults}/${kids}/0`;
    }

    const d1 = depDate.slice(2).replace(/-/g, '');
    const d2 = retDate.slice(2).replace(/-/g, '');
    return `https://www.skyscanner.com.br/transporte/passagens-aereas/${origin.toLowerCase()}/${dest.toLowerCase()}/${d1}/${d2}/?adults=${adults}&children=${kids}`;
  };

  const purchaseUrl = getPurchaseUrl(notification);

  const handleCopy = () => {
    navigator.clipboard.writeText(purchaseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" id="email-preview-modal">
      <div className="w-full max-w-2xl bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-800 text-white flex flex-col max-h-[90vh]">
        
        {/* Email App Header */}
        <div className="bg-zinc-950 px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span className="text-xs font-mono text-zinc-500 ml-2">Email_Client_V1.app</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Real-world Mail Envelope headers */}
        <div className="bg-zinc-900 p-4 border-b border-zinc-800 space-y-2 text-xs">
          <div className="flex">
            <span className="w-16 font-bold text-zinc-500">De:</span>
            <span className="text-blue-400 font-bold flex items-center gap-1">
              alertas@passagens.aistudio.com <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.2 rounded text-[9px] border border-blue-500/20">Robô Verificado</span>
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
            <span className="text-zinc-400">{new Date(notification.sentAt).toLocaleString("pt-BR")}</span>
          </div>
        </div>

        {/* Main Email Body Container */}
        <div className="bg-white text-zinc-800 p-8 overflow-y-auto flex-1 font-sans animate-fade-in">
          <div className="mx-auto max-w-xl border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            {/* Brand Header */}
            <div className="bg-blue-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="h-5 w-5 transform rotate-45" />
                <span className="font-extrabold tracking-tight text-sm">MONITOR_AÉREO</span>
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase border border-white/20 px-2 py-0.5 rounded bg-white/10">
                Alerta Imediato
              </span>
            </div>

            {/* Core Content */}
            <div className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Metas Atingidas</p>
                <h3 className="text-xl font-black text-slate-950 leading-tight">
                  Sua passagem está com preço ideal!
                </h3>
                <div className="mt-3 inline-flex items-center gap-3 bg-emerald-50 text-emerald-800 font-black text-2xl px-5 py-2.5 rounded-2xl border border-emerald-100 shadow-sm">
                  R$ {notification.price > 0 ? notification.price : "Simulado"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Preço teto configurado: <strong className="text-slate-700">R$ {notification.targetPrice > 0 ? notification.targetPrice : "---"}</strong>
                </p>
              </div>

              {/* Itinerary specifications */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 text-xs text-slate-700">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="font-semibold text-slate-400">Rota Monitorada</span>
                  <span className="font-extrabold text-slate-950 font-mono">
                    {notification.origin} ➔ {notification.destination}
                  </span>
                </div>
                <div>
                  <p className="text-slate-600 mb-1 leading-relaxed font-medium">
                    {notification.message}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Varredura via robô auxiliado por Inteligência Artificial</span>
                  <span className="text-emerald-600 font-bold">● Preço Confirmado</span>
                </div>
              </div>

              {/* Buttons Call-To-Action */}
              <div className="text-center space-y-3 pt-2">
                <a
                  href={purchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full text-center rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-xs font-bold text-white transition shadow-md shadow-blue-100/50 uppercase tracking-wider"
                  id="btn-buy-flight-direct"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ir para o Site de Compra & Reservar (R$ {notification.price > 0 ? notification.price : "Simulado"})
                </a>

                {/* Direct copyable link widget */}
                <div className="rounded-xl bg-slate-50 border border-slate-150 p-3 text-left space-y-1.5">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Link Direto Dedicado (Pré-preenchido)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={purchaseUrl}
                      className="flex-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-mono text-slate-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded transition whitespace-nowrap"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 leading-normal text-left">
                  Este link direciona você de forma automática para o canal oficial com os parâmetros de aeroportos, datas e passageiros já preenchidos. Os preços de passagens aéreas mudam rapidamente; recomendamos concluir a reserva o quanto antes.
                </p>
              </div>
            </div>

            {/* Email footer policy */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 text-center text-[9px] text-slate-400 space-y-1">
              <p className="font-bold">© 2026 Monitor de Passagens Aéreas. Todos os direitos reservados.</p>
              <p>Você recebeu este aviso porque cadastrou um alerta ativo de valor correspondente ao email: {notification.sentTo}</p>
              <p className="hover:underline cursor-pointer text-slate-500">Descadastrar este alerta de e-mail</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
