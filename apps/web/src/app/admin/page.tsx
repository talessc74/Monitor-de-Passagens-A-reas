'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import type { UserProfile } from '@mpa/types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';

/**
 * Painel de admin — lista quem já logou pelo menos uma vez e permite
 * conceder/revogar acesso total (bypass de plano, sem Stripe). Ver
 * _local-adr-policy-002 (controls). O gate real de autorização é o
 * backend (/api/admin/*, allowlist ADMIN_EMAILS) — este redirect é só
 * UX (evitar mostrar a tela pra quem vai receber 403 de qualquer jeito),
 * não é o controle de acesso em si.
 */
export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkedSelf, setCheckedSelf] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UserProfile | null) => {
        setProfile(data);
        setCheckedSelf(true);
        if (!data?.isAdmin) {
          router.replace('/profile');
        }
      });
  }, [user, router]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await apiFetch('/api/admin/users');
      if (res.ok) setUsers(await res.json());
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.isAdmin) loadUsers();
  }, [profile]);

  async function toggleAccess(target: UserProfile) {
    if (!target.email) return;
    setPendingEmail(target.email);
    setMessage('');
    try {
      const response = await apiFetch('/api/admin/grant-access', {
        method: 'POST',
        body: JSON.stringify({ email: target.email, isAdmin: !target.isAdmin }),
      });
      const data = await response.json();
      if (response.ok) {
        setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, isAdmin: !target.isAdmin } : u)));
      } else {
        setMessage(data.error || 'Falha ao atualizar acesso.');
      }
    } catch {
      setMessage('Erro de rede ao atualizar acesso.');
    } finally {
      setPendingEmail(null);
    }
  }

  if (loading || !user || !checkedSelf || !profile?.isAdmin) {
    return <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-ink-muted">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-10 text-ink antialiased">
      <div className="mx-auto max-w-2xl">
        <a href="/profile" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-terracotta">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </a>

        <div className="rounded-xl border border-border bg-paper-card p-6 shadow-card">
          <h1 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-terracotta" />
            Painel de administração
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Quem já usou o FlySpot pelo menos uma vez. Conceda acesso total pra beta-testers combinados, sem passar pelo Stripe.
          </p>
        </div>

        {message && <p className="mt-3 text-xs font-semibold text-danger-text">{message}</p>}

        <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-paper-card shadow-card">
          {usersLoading ? (
            <p className="p-6 text-sm text-ink-muted">Carregando usuários...</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">Nenhum usuário encontrado.</p>
          ) : (
            users.map((u) => (
              <div key={u.uid} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{u.email || u.uid}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                    {u.plan === 'pro' && <Sparkles className="h-3 w-3 text-terracotta" />}
                    {u.plan === 'pro' ? 'Pro' : 'Gratuito'}
                    <span className="text-border-strong">·</span>
                    desde {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    {u.isAdmin && (
                      <>
                        <span className="text-border-strong">·</span>
                        <span className="font-bold text-terracotta">Acesso total</span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => toggleAccess(u)}
                  disabled={pendingEmail === u.email}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
                    u.isAdmin
                      ? 'border border-border-strong text-ink-muted hover:bg-paper-deep'
                      : 'bg-terracotta-solid text-white hover:bg-terracotta-hover'
                  }`}
                >
                  {pendingEmail === u.email ? '...' : u.isAdmin ? 'Revogar' : 'Conceder acesso total'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
