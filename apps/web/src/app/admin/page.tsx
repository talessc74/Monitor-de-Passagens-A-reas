'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import type { UserProfile } from '@mpa/types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';

interface SourceDiagnostic {
  configured: boolean;
  ok: boolean;
  httpStatus?: number;
  error?: string;
}

interface DiagnosticsResponse {
  travelpayouts: SourceDiagnostic;
  skyScrapper: SourceDiagnostic;
  gemini: { configured: boolean };
}

interface CachedDestination {
  destination: string;
  price: number;
  gate: string;
  stops: number;
}

interface RoutesResponse {
  origin: string;
  configured: boolean;
  destinations: CachedDestination[];
  error?: string;
}

interface RouteTestResponse {
  origin: string;
  destination: string;
  configured: boolean;
  httpStatus?: number;
  itemCount?: number;
  cheapest?: { price: number; gate: string };
  error?: string;
}

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
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [routesOrigin, setRoutesOrigin] = useState('BSB');
  const [routesResult, setRoutesResult] = useState<RoutesResponse | null>(null);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routeTestOrigin, setRouteTestOrigin] = useState('BSB');
  const [routeTestDestination, setRouteTestDestination] = useState('MCO');
  const [routeTestResult, setRouteTestResult] = useState<RouteTestResponse | null>(null);
  const [routeTestLoading, setRouteTestLoading] = useState(false);

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

  async function loadDiagnostics() {
    setDiagnosticsLoading(true);
    try {
      const res = await apiFetch('/api/admin/diagnostics');
      if (res.ok) setDiagnostics(await res.json());
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  async function loadRoutes() {
    const origin = routesOrigin.toUpperCase().trim();
    if (origin.length < 3) return;
    setRoutesLoading(true);
    try {
      const res = await apiFetch(`/api/admin/travelpayouts-routes?origin=${encodeURIComponent(origin)}`);
      if (res.ok) setRoutesResult(await res.json());
    } finally {
      setRoutesLoading(false);
    }
  }

  async function loadRouteTest() {
    const origin = routeTestOrigin.toUpperCase().trim();
    const destination = routeTestDestination.toUpperCase().trim();
    if (origin.length < 3 || destination.length < 3) return;
    setRouteTestLoading(true);
    try {
      const res = await apiFetch(
        `/api/admin/travelpayouts-route-test?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
      );
      if (res.ok) setRouteTestResult(await res.json());
    } finally {
      setRouteTestLoading(false);
    }
  }

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

        <div className="mt-6 rounded-xl border border-border bg-paper-card p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-base font-semibold">Fontes de preço real</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Testa Travelpayouts e Sky Scrapper com uma chamada mínima de verdade — não só se a variável de ambiente existe.
              </p>
            </div>
            <button
              onClick={loadDiagnostics}
              disabled={diagnosticsLoading}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:bg-paper-deep disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${diagnosticsLoading ? 'animate-spin' : ''}`} />
              {diagnosticsLoading ? 'Testando...' : diagnostics ? 'Testar de novo' : 'Testar agora'}
            </button>
          </div>

          {diagnostics && (
            <div className="mt-4 space-y-2">
              <DiagnosticRow label="Travelpayouts" diag={diagnostics.travelpayouts} />
              <DiagnosticRow label="Sky Scrapper" diag={diagnostics.skyScrapper} />
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-paper-deep p-3 text-xs">
                <span className="font-bold">Gemini (simulador)</span>
                <span className={`flex items-center gap-1.5 font-bold ${diagnostics.gemini.configured ? 'text-teal' : 'text-ink-muted'}`}>
                  {diagnostics.gemini.configured ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {diagnostics.gemini.configured ? 'Configurada' : 'Não configurada (fallback offline)'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-paper-card p-6 shadow-card">
          <h2 className="font-serif text-base font-semibold">Cobertura do Travelpayouts por origem</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Lista os destinos com tarifa em cache saindo de um aeroporto — pra saber quais rotas têm cobertura real sem
            cadastrar um monitor por destino pra descobrir na marra.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={routesOrigin}
              onChange={(e) => setRoutesOrigin(e.target.value.toUpperCase())}
              placeholder="Ex: BSB"
              maxLength={4}
              className="w-28 rounded-md border border-border-strong bg-paper px-3 py-2 text-sm font-bold uppercase text-ink focus:border-terracotta focus:outline-none"
            />
            <button
              onClick={loadRoutes}
              disabled={routesLoading || routesOrigin.trim().length < 3}
              className="flex items-center gap-1.5 rounded-md bg-terracotta-solid px-3 py-2 text-xs font-bold text-white transition hover:bg-terracotta-hover disabled:cursor-not-allowed disabled:bg-paper-deep disabled:text-ink-muted"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${routesLoading ? 'animate-spin' : ''}`} />
              {routesLoading ? 'Buscando...' : 'Ver destinos'}
            </button>
          </div>

          {routesResult && (
            <div className="mt-4">
              {!routesResult.configured ? (
                <p className="text-xs text-ink-muted">Travelpayouts não está configurado (sem token).</p>
              ) : routesResult.error ? (
                <p className="text-xs text-danger-text">Erro: {routesResult.error}</p>
              ) : routesResult.destinations.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  Nenhum destino com tarifa em cache saindo de {routesResult.origin} — essa origem provavelmente cai 100% no
                  simulador por enquanto.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {routesResult.destinations.map((d) => (
                    <div key={d.destination} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="font-mono font-bold">
                        {routesResult.origin} → {d.destination}
                      </span>
                      <span className="text-ink-muted">
                        {d.gate} · {d.stops === 0 ? 'direto' : `${d.stops} parada(s)`}
                      </span>
                      <span className="font-mono font-bold text-terracotta">R$ {d.price.toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-paper-card p-6 shadow-card">
          <h2 className="font-serif text-base font-semibold">Testar rota específica</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Roda a mesma chamada que um scan de verdade faz pra essa origem+destino — útil quando a rota aparece no
            explorador acima mas o monitor continua vindo "Simulado".
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={routeTestOrigin}
              onChange={(e) => setRouteTestOrigin(e.target.value.toUpperCase())}
              placeholder="Origem"
              maxLength={4}
              className="w-24 rounded-md border border-border-strong bg-paper px-3 py-2 text-sm font-bold uppercase text-ink focus:border-terracotta focus:outline-none"
            />
            <span className="text-ink-muted">→</span>
            <input
              value={routeTestDestination}
              onChange={(e) => setRouteTestDestination(e.target.value.toUpperCase())}
              placeholder="Destino"
              maxLength={4}
              className="w-24 rounded-md border border-border-strong bg-paper px-3 py-2 text-sm font-bold uppercase text-ink focus:border-terracotta focus:outline-none"
            />
            <button
              onClick={loadRouteTest}
              disabled={routeTestLoading || routeTestOrigin.trim().length < 3 || routeTestDestination.trim().length < 3}
              className="flex items-center gap-1.5 rounded-md bg-terracotta-solid px-3 py-2 text-xs font-bold text-white transition hover:bg-terracotta-hover disabled:cursor-not-allowed disabled:bg-paper-deep disabled:text-ink-muted"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${routeTestLoading ? 'animate-spin' : ''}`} />
              {routeTestLoading ? 'Testando...' : 'Testar rota'}
            </button>
          </div>

          {routeTestResult && (
            <div className="mt-4 rounded-md border border-border bg-paper-deep p-3 text-xs">
              {!routeTestResult.configured ? (
                <p className="text-ink-muted">Travelpayouts não está configurado (sem token).</p>
              ) : routeTestResult.error ? (
                <p className="text-danger-text">
                  {routeTestResult.httpStatus ? `HTTP ${routeTestResult.httpStatus} — ` : ''}
                  {routeTestResult.error}
                </p>
              ) : routeTestResult.itemCount === 0 ? (
                <p className="text-ink-muted">
                  A API respondeu OK (HTTP {routeTestResult.httpStatus}) mas devolveu <strong>zero tarifas</strong> pra{' '}
                  {routeTestResult.origin} → {routeTestResult.destination} — sem cobertura pra esse par específico agora,
                  mesmo que o destino apareça na lista geral da origem.
                </p>
              ) : (
                <p>
                  <span className="font-bold text-teal">{routeTestResult.itemCount} tarifa(s)</span> encontrada(s) — mais
                  barata: <span className="font-mono font-bold">R$ {routeTestResult.cheapest?.price.toLocaleString('pt-BR')}</span> via{' '}
                  {routeTestResult.cheapest?.gate}.
                </p>
              )}
            </div>
          )}
        </div>

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

function DiagnosticRow({ label, diag }: { label: string; diag: SourceDiagnostic }) {
  const status = !diag.configured ? 'unconfigured' : diag.ok ? 'ok' : 'failed';
  return (
    <div className="rounded-md border border-border bg-paper-deep p-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold">{label}</span>
        <span
          className={`flex items-center gap-1.5 font-bold ${
            status === 'ok' ? 'text-teal' : status === 'failed' ? 'text-danger-text' : 'text-ink-muted'
          }`}
        >
          {status === 'ok' ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {status === 'ok' ? 'Funcionando' : status === 'failed' ? 'Falhou' : 'Não configurada'}
        </span>
      </div>
      {status === 'failed' && (
        <p className="mt-1 text-[11px] text-ink-muted">
          {diag.httpStatus ? `HTTP ${diag.httpStatus} — ` : ''}
          {diag.error || 'Erro desconhecido'}
        </p>
      )}
    </div>
  );
}
