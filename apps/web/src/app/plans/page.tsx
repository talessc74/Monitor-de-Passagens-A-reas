'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import type { UserProfile } from '@mpa/types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';

const FREE_FEATURES = ['2 monitores ativos', 'Varredura a cada 6 horas', 'Histórico de preço por 7 dias', 'Alertas por e-mail'];
const PRO_FEATURES = ['10 monitores ativos', 'Varredura a cada 1 hora', 'Histórico de preço por 90 dias', 'Alertas por e-mail', 'Alertas por Telegram (em breve)'];

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-400 text-sm">Carregando...</div>}>
      <PlansPageContent />
    </Suspense>
  );
}

function PlansPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setProfile)
      .finally(() => setIsLoading(false));
  }, [user]);

  const checkoutStatus = searchParams.get('checkout');

  async function handleUpgrade() {
    setIsRedirecting(true);
    setError('');
    try {
      const response = await apiFetch('/billing/checkout', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Não foi possível iniciar a assinatura agora.');
      }
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.');
      setIsRedirecting(false);
    }
  }

  if (authLoading || !user || isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  }

  const isPro = profile?.plan === 'pro';

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <a href="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </a>

        <div className="text-center mb-8">
          <h1 className="text-xl font-black text-slate-800">Escolha seu plano</h1>
          <p className="mt-1 text-sm text-slate-500">Modo de teste — nenhuma cobrança real é feita.</p>
        </div>

        {checkoutStatus === 'success' && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Assinatura confirmada! Pode levar alguns segundos para o plano Pro aparecer aqui.
          </div>
        )}
        {checkoutStatus === 'canceled' && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm font-semibold text-slate-600">
            Checkout cancelado — nenhuma cobrança foi feita.
          </div>
        )}
        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Gratuito</h2>
              {!isPro && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Plano atual</span>}
            </div>
            <p className="mt-2 text-2xl font-black text-slate-800">R$ 0</p>
            <ul className="mt-4 space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                  <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-blue-500 bg-white p-6 shadow-md shadow-blue-50 relative">
            <div className="absolute -top-3 left-6 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Recomendado
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-700">Pro</h2>
              {isPro && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Plano atual</span>}
            </div>
            <p className="mt-2 text-2xl font-black text-slate-800">
              R$ 29<span className="text-sm font-semibold text-slate-400">/mês</span>
            </p>
            <ul className="mt-4 space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                  <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
                  {f}
                </li>
              ))}
            </ul>

            {!isPro && (
              <button
                onClick={handleUpgrade}
                disabled={isRedirecting}
                className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isRedirecting ? 'Redirecionando...' : 'Assinar Pro'}
              </button>
            )}
            {isPro && (
              <a
                href="/profile"
                className="mt-5 block text-center w-full rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                Gerenciar assinatura
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
