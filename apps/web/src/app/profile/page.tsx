'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Sparkles, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '@mpa/types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantMessage, setGrantMessage] = useState('');
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setProfile);
  }, [user]);

  async function handleManageSubscription() {
    setIsRedirecting(true);
    try {
      const response = await apiFetch('/billing/portal', { method: 'POST' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setIsRedirecting(false);
    }
  }

  async function handleGrantAccess(grant: boolean) {
    setGranting(true);
    setGrantMessage('');
    try {
      const response = await apiFetch('/api/admin/grant-access', {
        method: 'POST',
        body: JSON.stringify({ email: grantEmail, isAdmin: grant }),
      });
      const data = await response.json();
      setGrantMessage(response.ok ? `${grant ? 'Acesso total concedido' : 'Acesso total revogado'} para ${grantEmail}.` : data.error || 'Falha ao atualizar acesso.');
    } catch {
      setGrantMessage('Erro de rede ao atualizar acesso.');
    } finally {
      setGranting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError('');
    try {
      const response = await apiFetch('/api/me', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Falha ao apagar a conta');
      }
      await signOut();
      router.replace('/login');
    } catch (err) {
      setError('Não foi possível apagar sua conta agora. Tente novamente.');
      setDeleting(false);
    }
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-ink-muted">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-10 text-ink antialiased">
      <div className="mx-auto max-w-lg">
        <a href="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-terracotta">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </a>

        <div className="rounded-xl border border-border bg-paper-card p-6 shadow-card">
          <h1 className="font-serif text-lg font-semibold">Seu perfil</h1>
          <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-paper-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">Plano</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                {profile?.plan === 'pro' && <Sparkles className="h-3.5 w-3.5 text-terracotta" />}
                {profile?.plan === 'pro' ? 'Pro' : 'Gratuito'}
                {profile?.isAdmin && (
                  <span className="ml-1 flex items-center gap-1 rounded bg-terracotta-wash px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-terracotta">
                    <ShieldCheck className="h-3 w-3" />
                    Acesso total
                  </span>
                )}
              </p>
            </div>
            {profile?.plan === 'pro' ? (
              <button
                onClick={handleManageSubscription}
                disabled={isRedirecting}
                className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:bg-paper-deep disabled:opacity-60"
              >
                {isRedirecting ? 'Redirecionando...' : 'Gerenciar assinatura'}
              </button>
            ) : (
              <a
                href="/plans"
                className="rounded-md bg-terracotta-solid px-3 py-1.5 text-xs font-bold text-white transition hover:bg-terracotta-hover"
              >
                Fazer upgrade
              </a>
            )}
          </div>
        </div>

        {profile?.isAdmin && (
          <div className="mt-6 rounded-xl border border-border bg-paper-card p-6 shadow-card">
            <h2 className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-terracotta" />
              Gerenciar acesso de beta-testers
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Concede ou revoga acesso total (bypass de plano, sem passar pelo Stripe) para o e-mail de um usuário que já fez login pelo menos uma vez.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="email"
                placeholder="email@do-beta-tester.com"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                className="min-w-[220px] flex-1 rounded-md border border-border-strong bg-paper px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
              <button
                onClick={() => handleGrantAccess(true)}
                disabled={granting || !grantEmail}
                className="rounded-md bg-terracotta-solid px-3 py-2 text-xs font-bold text-white transition hover:bg-terracotta-hover disabled:opacity-60"
              >
                Conceder
              </button>
              <button
                onClick={() => handleGrantAccess(false)}
                disabled={granting || !grantEmail}
                className="rounded-md border border-border-strong px-3 py-2 text-xs font-bold text-ink-muted transition hover:bg-paper-deep disabled:opacity-60"
              >
                Revogar
              </button>
            </div>
            {grantMessage && <p className="mt-2 text-xs font-semibold text-ink">{grantMessage}</p>}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-danger-border bg-danger-bg p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-danger-text">
            <AlertTriangle className="h-4 w-4" />
            Zona de risco
          </h2>
          <p className="mt-1 text-xs text-danger-text">
            Deletar sua conta remove permanentemente todos os seus monitores, histórico de preços e notificações. Essa ação não pode ser desfeita.
          </p>

          {error && <p className="mt-2 text-xs font-semibold text-danger-text">{error}</p>}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="mt-4 rounded-md border border-danger-border-strong bg-paper-card px-4 py-2 text-xs font-bold text-danger-text transition hover:bg-danger-border/30"
            >
              Deletar minha conta
            </button>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="rounded-md bg-danger-solid px-4 py-2 text-xs font-bold text-white transition hover:bg-danger-solid-hover disabled:opacity-60"
              >
                {deleting ? 'Apagando...' : 'Sim, apagar tudo'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-md border border-border-strong px-4 py-2 text-xs font-bold text-ink-muted transition hover:bg-paper-deep"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
