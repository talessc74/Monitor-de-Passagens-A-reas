'use client';

import { useEffect, useState } from 'react';
import { Mail, Eye, Send } from 'lucide-react';
import type { NotificationLog } from '@mpa/types';

interface NotificationFeedProps {
  notifications: NotificationLog[];
  onOpenEmailPreview: (notif: NotificationLog) => void;
  onClearAll: () => void;
  onSendTestEmail: (to: string, subject: string, content: string) => Promise<{ success: boolean; message: string }>;
  userEmail: string;
}

const TEST_EMAIL_STORAGE_KEY = 'flyspot:testEmail';

export default function NotificationFeed({ notifications, onOpenEmailPreview, onClearAll, onSendTestEmail, userEmail }: NotificationFeedProps) {
  // Lembra o último e-mail de teste digitado (localStorage, por navegador)
  // em vez de sempre recomeçar com o e-mail de login a cada refresh —
  // quem quer testar num e-mail diferente do login não deveria ter que
  // digitar de novo toda vez.
  const [testEmail, setTestEmail] = useState(() => {
    if (typeof window === 'undefined') return userEmail;
    return window.localStorage.getItem(TEST_EMAIL_STORAGE_KEY) || userEmail;
  });

  useEffect(() => {
    if (testEmail) window.localStorage.setItem(TEST_EMAIL_STORAGE_KEY, testEmail);
  }, [testEmail]);
  const [testSubject, setTestSubject] = useState('Voo Barato para Lisboa!');
  const [testContent, setTestContent] = useState(
    'Encontramos voos diretos de Guarulhos para Lisboa por apenas R$ 3.890 para outubro. Valor abaixo do seu teto de R$ 4.000!'
  );
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResultMessage, setTestResultMessage] = useState('');
  const [testResultIsError, setTestResultIsError] = useState(false);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingTest(true);
    setTestResultMessage('');

    const { success, message } = await onSendTestEmail(testEmail, testSubject, testContent);
    setTestResultMessage(message);
    setTestResultIsError(!success);
    setTimeout(() => setTestResultMessage(''), 6000);
    setIsSendingTest(false);
  };

  return (
    <div className="rounded-xl border border-border bg-paper-card shadow-card" id="notification-alerts-center">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="font-serif text-lg font-semibold">Central de notificações</h2>
          <p className="text-xs text-ink-muted">Histórico de e-mails emitidos</p>
        </div>
        {notifications.length > 0 && (
          <button onClick={onClearAll} className="text-[10px] font-bold uppercase tracking-wide text-danger-text transition hover:opacity-75">
            Limpar histórico
          </button>
        )}
      </div>

      <div className="border-b border-border p-5">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-ink">
          <Mail className="h-3.5 w-3.5 text-terracotta" />
          Testar canal de alerta imediato
        </h3>
        <form onSubmit={handleSendTest} className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="nf-test-to" className="sr-only">Destinatário</label>
              <input
                id="nf-test-to"
                type="email"
                placeholder="Destinatário"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full rounded-md border border-border-strong bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                required
              />
            </div>
            <div>
              <label htmlFor="nf-test-subject" className="sr-only">Assunto</label>
              <input
                id="nf-test-subject"
                type="text"
                placeholder="Assunto"
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                className="w-full rounded-md border border-border-strong bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="nf-test-content" className="sr-only">Conteúdo do alerta</label>
            <textarea
              id="nf-test-content"
              placeholder="Conteúdo do alerta..."
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border-strong bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              required
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {testResultMessage ? (
              <span className={`text-[10px] font-bold ${testResultIsError ? 'text-danger-text' : 'text-teal'}`}>{testResultMessage}</span>
            ) : (
              <span className="text-[10px] font-semibold text-ink-muted">Envia de verdade via Resend, se configurado.</span>
            )}
            <button
              type="submit"
              disabled={isSendingTest}
              className="flex items-center gap-1 whitespace-nowrap rounded-md bg-terracotta-solid px-3 py-1.5 text-xs font-bold text-white transition hover:bg-terracotta-hover disabled:opacity-60"
            >
              <Send className="h-3 w-3" />
              {isSendingTest ? 'Disparando...' : 'Enviar alerta de teste'}
            </button>
          </div>
        </form>
      </div>

      <div className="p-5">
        {notifications.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-8 text-center text-xs text-ink-muted">
            <Mail className="mx-auto mb-2 h-6 w-6 text-ink-muted" />
            Nenhuma notificação enviada ainda.
            <p className="mt-1 text-[10px] font-semibold text-ink-muted">Crie um monitor e clique em &quot;Varrer Agora&quot; para disparar buscas!</p>
          </div>
        ) : (
          notifications.map((notif, i) => (
            <div
              key={notif.id}
              className={`grid grid-cols-1 gap-2 py-4 sm:grid-cols-[100px_1fr_auto] sm:gap-4 ${i < notifications.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="font-mono text-[11px] text-ink-muted">
                {new Date(notif.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                <br />
                {new Date(notif.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="min-w-0">
                <h4 className={`text-[13px] font-bold ${notif.type === 'target_reached' ? 'text-teal' : 'text-ink'}`}>
                  {notif.title}
                </h4>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{notif.message}</p>
              </div>
              <button
                onClick={() => onOpenEmailPreview(notif)}
                className="whitespace-nowrap text-left text-[11px] font-bold text-terracotta underline underline-offset-2 hover:no-underline sm:text-right"
              >
                <Eye className="mr-1 inline h-3 w-3" />
                Abrir e-mail
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
