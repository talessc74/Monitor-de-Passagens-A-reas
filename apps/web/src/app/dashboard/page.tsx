'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { FlightMonitor, AirlineSite, NotificationLog } from '@mpa/types';
import { useAuth } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';
import Header from '../../components/Header';
import MonitorForm from '../../components/MonitorForm';
import MonitorCard from '../../components/MonitorCard';
import SitesList from '../../components/SitesList';
import NotificationFeed from '../../components/NotificationFeed';
import EmailModal from '../../components/EmailModal';
import RadarEmptyState from '../../components/RadarEmptyState';
import ErrorCard from '../../components/ErrorCard';

type PricedMonitor = FlightMonitor & { currentPrice: number };

function pickHeroMonitor(monitors: FlightMonitor[]): PricedMonitor | null {
  const priced = monitors.filter(
    (m): m is PricedMonitor => m.status === 'active' && typeof m.currentPrice === 'number' && m.targetPrice > 0
  );
  if (priced.length === 0) return null;
  const stillWaiting = priced.filter((m) => m.currentPrice > m.targetPrice);
  const pool = stillWaiting.length > 0 ? stillWaiting : priced;
  return pool.reduce((best, m) => {
    const gap = Math.abs(m.currentPrice - m.targetPrice) / m.targetPrice;
    const bestGap = Math.abs(best.currentPrice - best.targetPrice) / best.targetPrice;
    return gap < bestGap ? m : best;
  });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD} ${diffD === 1 ? 'dia' : 'dias'}`;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [monitors, setMonitors] = useState<FlightMonitor[]>([]);
  const [sites, setSites] = useState<AirlineSite[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<NotificationLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [upgradeMessage, setUpgradeMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [monitorsRes, sitesRes, notificationsRes] = await Promise.all([
        apiFetch('/api/monitors'),
        apiFetch('/api/sites'),
        apiFetch('/api/notifications'),
      ]);

      if (!monitorsRes.ok || !sitesRes.ok || !notificationsRes.ok) {
        throw new Error('Erro de resposta do servidor back-end');
      }

      setMonitors(await monitorsRes.json());
      setSites(await sitesRes.json());
      setNotifications(await notificationsRes.json());
    } catch (err) {
      console.error('Falha ao recuperar dados:', err);
      setErrorMessage('Não foi possível conectar ao servidor de passagens aéreas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMonitor = async (payload: any): Promise<boolean> => {
    setErrorMessage('');
    setUpgradeMessage('');
    try {
      const response = await apiFetch('/api/monitors', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status === 403 && body?.upgradeRequired) {
          setUpgradeMessage(body.error);
          return false;
        }
        throw new Error(body?.error || 'Falha ao cadastrar seu alerta de passagens');
      }

      const newMon = await response.json();
      setMonitors((prev) => [newMon, ...prev]);
      handleScanMonitor(newMon.id);
      return true;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro desconhecido ao cadastrar.');
      return false;
    }
  };

  const handleScanMonitor = async (id: string): Promise<any> => {
    try {
      const response = await apiFetch(`/api/monitors/${id}/scan`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Erro na solicitação de escaneamento');
      }

      const data = await response.json();
      if (data && data.success) {
        setMonitors((prev) => prev.map((m) => (m.id === id ? data.monitor : m)));

        const notifRes = await apiFetch('/api/notifications');
        if (notifRes.ok) setNotifications(await notifRes.json());

        const sitesRes = await apiFetch('/api/sites');
        if (sitesRes.ok) setSites(await sitesRes.json());
      }
      return data;
    } catch (err) {
      console.error('Erro no escaneamento:', err);
      throw err;
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    try {
      const response = await apiFetch(`/api/monitors/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setMonitors((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error('Erro ao deletar monitor:', err);
    }
  };

  const handleEditMonitor = async (id: string, patch: Record<string, unknown>): Promise<boolean> => {
    try {
      const response = await apiFetch(`/api/monitors/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const updated = await response.json();
        setMonitors((prev) => prev.map((m) => (m.id === id ? updated : m)));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao editar monitor:', err);
      return false;
    }
  };

  const handleToggleMonitorStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const response = await apiFetch(`/api/monitors/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok) {
        const updated = await response.json();
        setMonitors((prev) => prev.map((m) => (m.id === id ? updated : m)));
      }
    } catch (err) {
      console.error('Erro ao alterar status do monitor:', err);
    }
  };

  const handleToggleSiteStatus = async (id: string) => {
    try {
      const response = await apiFetch(`/api/sites/${id}/toggle`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSites((prev) => prev.map((s) => (s.id === id ? data.site : s)));
        }
      }
    } catch (err) {
      console.error('Erro ao alterar status do site:', err);
    }
  };

  const handleClearNotifications = async () => {
    try {
      const response = await apiFetch('/api/notifications', { method: 'DELETE' });
      if (response.ok) setNotifications([]);
    } catch (err) {
      console.error('Erro ao limpar avisos:', err);
    }
  };

  const handleSendTestEmail = async (to: string, subject: string, content: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiFetch('/api/test-email', {
        method: 'POST',
        body: JSON.stringify({ to, subject, content }),
      });
      const data = await response.json();
      const notifRes = await apiFetch('/api/notifications');
      if (notifRes.ok) setNotifications(await notifRes.json());
      if (response.ok) {
        return { success: true, message: data.message as string };
      }
      return { success: false, message: (data.details as string) || (data.error as string) || 'Falha ao enviar e-mail de teste.' };
    } catch (err) {
      console.error('Erro ao disparar e-mail de teste:', err);
      return { success: false, message: 'Erro de rede ao disparar e-mail de teste.' };
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-ink-muted">
        Carregando...
      </div>
    );
  }

  const activeMonitors = monitors.filter((m) => m.status === 'active');
  const targetHitCount = activeMonitors.filter((m) => m.currentPrice !== null && m.currentPrice <= m.targetPrice).length;
  const currentUserEmail = user.email ?? '';
  const heroMonitor = pickHeroMonitor(monitors);
  const heroGapPct = heroMonitor
    ? Math.round((Math.abs(heroMonitor.currentPrice - heroMonitor.targetPrice) / heroMonitor.targetPrice) * 100)
    : null;
  const lastNotification = notifications[0] ?? null;

  return (
    <div className="min-h-screen bg-paper pb-16 text-ink antialiased">
      <Header />

      <main className="mx-auto max-w-[1240px] px-6">
        <div className="pt-9">
          {errorMessage && <ErrorCard message={errorMessage} onRetry={fetchData} retrying={isLoading} />}

          {upgradeMessage && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-terracotta/30 bg-terracotta-wash p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 shrink-0 text-terracotta" aria-hidden="true" />
                <p className="text-sm font-semibold text-ink">{upgradeMessage}</p>
              </div>
              <a
                href="/plans"
                className="shrink-0 rounded-md bg-terracotta-solid px-3 py-1.5 text-xs font-bold text-white transition hover:bg-terracotta-hover"
              >
                Ver planos
              </a>
            </div>
          )}

          <div className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr_1fr]">
            <div className="rounded-xl bg-ink-strong p-6 text-paper-on-ink">
              <div className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-paper-on-ink-muted">
                Mais perto da meta
              </div>
              {heroMonitor ? (
                <>
                  <div className="mb-1.5 flex items-baseline gap-2.5 font-mono text-xl font-bold sm:text-2xl">
                    {heroMonitor.origin} <span className="text-terracotta-tint">→</span> {heroMonitor.destination}
                  </div>
                  <p className="max-w-[34ch] text-[13px] text-paper-on-ink-muted">
                    Menor preço lido está a{' '}
                    <span className="font-bold text-terracotta-tint">{heroGapPct}%</span>{' '}
                    {heroMonitor.currentPrice > heroMonitor.targetPrice ? 'da sua meta' : 'abaixo da sua meta'} de R${' '}
                    {heroMonitor.targetPrice.toLocaleString('pt-BR')}. Última leitura: R${' '}
                    {heroMonitor.currentPrice.toLocaleString('pt-BR')}.
                  </p>
                </>
              ) : (
                <p className="max-w-[34ch] text-[13px] text-paper-on-ink-muted">
                  Assim que um dos seus alertas tiver uma leitura de preço, mostramos aqui o mais perto de bater a meta.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-paper-card p-6">
              <div className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">Alertas ativos</div>
              <div className="font-mono text-3xl font-bold leading-none">{activeMonitors.length}</div>
              <div className="mt-2 text-xs text-ink-muted">
                {activeMonitors.length - targetHitCount} aguardando · {targetHitCount} meta atingida
              </div>
            </div>

            <div className="rounded-xl border border-border bg-paper-card p-6">
              <div className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">Notificações enviadas</div>
              <div className="font-mono text-3xl font-bold leading-none">{notifications.length}</div>
              <div className="mt-2 text-xs text-ink-muted">
                {lastNotification ? `Última ${timeAgo(lastNotification.sentAt)}` : 'Nenhuma ainda'}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 py-12 text-ink-muted">
              <RefreshCw className="h-8 w-8 animate-spin text-terracotta" aria-hidden="true" />
              <p className="text-xs font-semibold">Carregando seus monitores...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-7 lg:grid-cols-[5fr_7fr] lg:items-start">
              <div className="space-y-7">
                <MonitorForm airlineSites={sites} onSubmit={handleAddMonitor} currentUserEmail={currentUserEmail} />
                <SitesList sites={sites} onToggleSiteStatus={handleToggleSiteStatus} />
              </div>

              <div className="space-y-7">
                <div>
                  <div className="mb-4">
                    <h2 className="font-serif text-lg font-semibold">Seus alertas de passagens</h2>
                    <p className="text-xs text-ink-muted">
                      {monitors.length === 0
                        ? 'Nenhuma rota sendo vigiada ainda'
                        : `${monitors.length} ${monitors.length === 1 ? 'rota sendo vigiada' : 'rotas sendo vigiadas'} agora`}
                    </p>
                  </div>

                  {monitors.length === 0 ? (
                    <RadarEmptyState />
                  ) : (
                    <div className="grid grid-cols-1 gap-5">
                      {monitors.map((monitor) => (
                        <MonitorCard
                          key={monitor.id}
                          monitor={monitor}
                          airlineSites={sites}
                          onScan={handleScanMonitor}
                          onDelete={handleDeleteMonitor}
                          onToggleStatus={handleToggleMonitorStatus}
                          onEdit={handleEditMonitor}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <NotificationFeed
                  notifications={notifications}
                  onOpenEmailPreview={setSelectedEmail}
                  onClearAll={handleClearNotifications}
                  onSendTestEmail={handleSendTestEmail}
                  userEmail={currentUserEmail}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <EmailModal notification={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </div>
  );
}
