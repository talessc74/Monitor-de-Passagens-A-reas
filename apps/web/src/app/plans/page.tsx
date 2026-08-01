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
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-paper text-sm text-ink-muted">Carregando...</div>}>
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
    return <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-ink-muted">Carregando...</div>;
  }

  const isPro = profile?.plan === 'pro';

  return (
    <div className="min-h-screen bg-paper px-4 py-10 text-ink antialiased">
      <div className="mx-auto max-w-3xl">
        <a href="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-terracotta">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </a>

        <div className="mb-8 text-center">
          <h1 className="font-serif text-xl font-semibold">Escolha seu plano</h1>
          <p className="mt-1 text-sm text-ink-muted">Modo de teste. Nenhuma cobrança real é feita.</p>
        </div>

        {checkoutStatus === 'success' && (
          <div className="mb-6 rounded-xl border border-teal/30 bg-teal/10 p-4 text-sm font-semibold text-teal">
            Assinatura confirmada! Pode levar alguns segundos para o plano Pro aparecer aqui.
          </div>
        )}
        {checkoutStatus === 'canceled' && (
          <div className="mb-6 rounded-xl border border-border bg-paper-deep p-4 text-sm font-semibold text-ink-muted">
            Checkout cancelado. Nenhuma cobrança foi feita.
          </div>
        )}
        {error && <div className="mb-6 rounded-xl border border-danger-border bg-danger-bg p-4 text-sm font-semibold text-danger-text">{error}</div>}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-paper-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">Gratuito</h2>
              {!isPro && <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-bold text-ink-muted">Plano atual</span>}
            </div>
            <p className="mt-2 font-mono text-2xl font-black">R$ 0</p>
            <ul className="mt-4 space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs font-medium text-ink-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative rounded-xl border-2 border-terracotta bg-paper-card p-6 shadow-card">
            <div className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-terracotta-solid px-2.5 py-0.5 text-[10px] font-bold text-white">
              <Sparkles className="h-3 w-3" />
              Recomendado
            </div>
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-terracotta">Pro</h2>
              {isPro && <span className="rounded-full bg-terracotta-wash px-2 py-0.5 text-[10px] font-bold text-terracotta">Plano atual</span>}
            </div>
            <p className="mt-2 font-mono text-2xl font-black">
              R$ 29<span className="text-sm font-semibold text-ink-muted">/mês</span>
            </p>
            {!isPro && !profile?.stripeSubscriptionId && (
              <p className="mt-1 text-xs font-bold text-teal">10 dias grátis para testar antes de pagar</p>
            )}
            <ul className="mt-4 space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs font-medium text-ink-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" />
                  {f}
                </li>
              ))}
            </ul>

            {!isPro && (
              <button
                onClick={handleUpgrade}
                disabled={isRedirecting}
                className="mt-5 w-full rounded-md bg-terracotta-solid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:bg-paper-deep disabled:text-ink-muted"
              >
                {isRedirecting ? 'Redirecionando...' : !profile?.stripeSubscriptionId ? 'Começar trial de 10 dias' : 'Assinar Pro'}
              </button>
            )}
            {isPro && (
              <a
                href="/profile"
                className="mt-5 block w-full rounded-md border border-terracotta/30 px-4 py-2.5 text-center text-sm font-semibold text-terracotta transition hover:bg-terracotta-wash"
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
