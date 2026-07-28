/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Mail, Clock, ArrowRight, Eye, RefreshCw, Send } from "lucide-react";
import { NotificationLog } from "../types";

interface NotificationFeedProps {
  notifications: NotificationLog[];
  onOpenEmailPreview: (notif: NotificationLog) => void;
  onClearAll: () => void;
  onSendTestEmail: (to: string, subject: string, content: string) => Promise<boolean>;
  userEmail: string;
}

export default function NotificationFeed({
  notifications,
  onOpenEmailPreview,
  onClearAll,
  onSendTestEmail,
  userEmail,
}: NotificationFeedProps) {
  const [testEmail, setTestEmail] = useState(userEmail);
  const [testSubject, setTestSubject] = useState("Voo Barato para Lisboa! ✈");
  const [testContent, setTestContent] = useState("Encontramos voos diretos de Guarulhos para Lisboa por apenas R$ 3.890 para outubro. Valor abaixo do seu teto de R$ 4.000!");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState("");

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingTest(true);
    setTestSuccessMessage("");

    const success = await onSendTestEmail(testEmail, testSubject, testContent);
    if (success) {
      setTestSuccessMessage("Mensagem de teste disparada! Verifique o log abaixo.");
      setTimeout(() => setTestSuccessMessage(""), 4000);
    }
    setIsSendingTest(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/30" id="notification-alerts-center">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Central de Alertas & Notificações</h2>
          <p className="text-xs text-slate-400 font-medium">Histórico de e-mails emitidos de forma síncrona</p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[10px] font-bold text-red-650 hover:text-red-700 uppercase tracking-wider transition"
          >
            Limpar Histórico
          </button>
        )}
      </div>

      {/* Test simulation block */}
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/15 p-3">
        <h3 className="text-xs font-bold text-blue-950 flex items-center gap-1.5 mb-2.5">
          <Mail className="h-3.5 w-3.5 text-blue-600" />
          Testar Canal de Alerta Imediato
        </h3>
        <form onSubmit={handleSendTest} className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="email"
              placeholder="Destinatário"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium transition"
              required
            />
            <input
              type="text"
              placeholder="Assunto"
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium transition"
              required
            />
          </div>
          <textarea
            placeholder="Conteúdo do alerta..."
            value={testContent}
            onChange={(e) => setTestContent(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium transition"
            required
          />
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            {testSuccessMessage ? (
              <span className="text-[10px] text-emerald-700 font-bold">{testSuccessMessage}</span>
            ) : (
              <span className="text-[10px] text-slate-400 font-semibold">Simula o envio imediato às APIs de SMTP.</span>
            )}
            <button
              type="submit"
              disabled={isSendingTest}
              className="flex items-center gap-1 border-0 hover:bg-blue-750 bg-blue-600 font-bold px-3 py-1.5 rounded text-white text-xs whitespace-nowrap shadow-sm shadow-blue-100 transition active:scale-95"
            >
              <Send className="h-3 w-3" />
              {isSendingTest ? "Disparando..." : "Enviar Alerta de Teste"}
            </button>
          </div>
        </form>
      </div>

      {/* Notifications history */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <Mail className="h-6 w-6 stroke-slate-300 mx-auto mb-2" />
            Nenhuma notificação enviada ainda.
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">Crie um monitor e clique em "Varrer Agora" para disparar buscas!</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex flex-col gap-2 rounded-xl border p-3.5 transition ${
                notif.type === "target_reached"
                  ? "border-emerald-200 bg-emerald-50/10 shadow-emerald-50"
                  : "border-slate-100 bg-slate-50/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${
                    notif.type === "target_reached" 
                      ? "bg-emerald-100 text-emerald-850 border-emerald-200/50" 
                      : "bg-blue-100 text-blue-800 border-blue-200/50"
                  }`}>
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-tight">{notif.title}</h4>
                    <span className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5 font-bold">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {new Date(notif.sentAt).toLocaleString("pt-BR")} • Destino: {notif.sentTo}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onOpenEmailPreview(notif)}
                  className="text-[9px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 border border-blue-100 bg-blue-50/30 px-2 py-1 rounded transition"
                >
                  <Eye className="h-3 w-3" />
                  Abrir E-mail
                </button>
              </div>

              <p className="text-xs text-slate-650 font-medium leading-relaxed pl-2 border-l-2 border-slate-200 py-0.5">
                {notif.message}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
