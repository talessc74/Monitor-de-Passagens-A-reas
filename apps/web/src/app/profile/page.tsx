'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, Sparkles } from 'lucide-react';
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
    return <div className="flex min-h-screen items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <a href="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </a>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-800">Seu perfil</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Plano</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800">
                {profile?.plan === 'pro' && <Sparkles className="h-3.5 w-3.5 text-blue-600" />}
                {profile?.plan === 'pro' ? 'Pro' : 'Gratuito'}
              </p>
            </div>
            {profile?.plan === 'pro' ? (
              <button
                onClick={handleManageSubscription}
                disabled={isRedirecting}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-60"
              >
                {isRedirecting ? 'Redirecionando...' : 'Gerenciar assinatura'}
              </button>
            ) : (
              <a
                href="/plans"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Fazer upgrade
              </a>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-red-800">
            <AlertTriangle className="h-4 w-4" />
            Zona de risco
          </h2>
          <p className="mt-1 text-xs text-red-700">
            Deletar sua conta remove permanentemente todos os seus monitores, histórico de preços e notificações. Essa ação não pode ser desfeita.
          </p>

          {error && <p className="mt-2 text-xs font-semibold text-red-800">{error}</p>}

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition"
            >
              Deletar minha conta
            </button>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-60"
              >
                {deleting ? 'Apagando...' : 'Sim, apagar tudo'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
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
