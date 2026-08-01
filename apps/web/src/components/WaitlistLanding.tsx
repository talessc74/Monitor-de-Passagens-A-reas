'use client';

import { useState } from 'react';
import { Plane, Mail, CheckCircle2 } from 'lucide-react';

/**
 * Landing de espera (pré-lançamento) — ver _local-adr-policy-004 (platform).
 * Regras inegociáveis do Conselho (não flexibilizar sem nova deliberação):
 * 1. Nunca menciona fornecedor de dados técnico.
 * 2. Nunca declara prazo/data de lançamento, nem implícito.
 * 3. Nunca promete precisão técnica — a promessa é sobre o alerta, não a tecnologia.
 */
export default function WaitlistLanding() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — mantido vazio por humanos
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
      if (!res.ok) throw new Error('Falha ao cadastrar');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Plane className="h-5 w-5 rotate-45" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800">
            Fly<span className="text-blue-600">Spot</span>
          </h1>
        </div>

        <h2 className="mb-3 text-3xl font-bold text-slate-900">
          Aquela viagem que importa, pelo preço certo.
        </h2>
        <p className="mb-8 text-base text-slate-600">
          Lua de mel, formatura, a volta pra casa pra ver a família — conta pra gente qual é a sua
          meta de preço, e a gente te avisa assim que ela for atingida. Sem precisar ficar
          recarregando site de passagem todo dia.
        </p>

        {status === 'done' ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-blue-600" />
            <p className="text-sm font-medium text-slate-800">
              Cadastro recebido! Ainda não temos uma data de lançamento definida — vamos te avisar
              assim que o FlySpot estiver pronto pra sua rota.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {/* Honeypot anti-spam: invisível pra humano, tentador pra bot */}
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                aria-hidden="true"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {status === 'submitting' ? 'Enviando...' : 'Quero ser avisado'}
            </button>

            {status === 'error' && (
              <p className="text-xs text-red-600">Algo deu errado. Tenta de novo em instantes.</p>
            )}

            <p className="pt-2 text-xs text-slate-400">
              Usaremos seu e-mail só pra avisar sobre o lançamento do FlySpot.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
