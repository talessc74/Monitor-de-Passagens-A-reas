'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plane, Sparkles, Server, RefreshCw } from 'lucide-react';
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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [monitors, setMonitors] = useState<FlightMonitor[]>([]);
  const [sites, setSites] = useState<AirlineSite[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [activeTab, setActiveTab] = useState<'monitors' | 'sites'>('monitors');
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

  const handleSendTestEmail = async (to: string, subject: string, content: string): Promise<boolean> => {
    try {
      const response = await apiFetch('/api/test-email', {
        method: 'POST',
        body: JSON.stringify({ to, subject, content }),
      });
      if (response.ok) {
        const notifRes = await apiFetch('/api/notifications');
        if (notifRes.ok) setNotifications(await notifRes.json());
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao disparar e-mail de teste:', err);
      return false;
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  const activeMonitorsCount = monitors.filter((m) => m.status === 'active').length;
  const currentUserEmail = user.email ?? '';

  return (
    <div className="min-h-screen bg-slate-55 pb-16 font-sans antialiased text-slate-900" id="app-container">
      <Header activeMonitorsCount={activeMonitorsCount} notificationsCount={notifications.length} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
        {errorMessage && <ErrorCard message={errorMessage} onRetry={fetchData} retrying={isLoading} />}

        {upgradeMessage && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-blue-600" />
              <p className="text-sm font-semibold text-blue-900">{upgradeMessage}</p>
            </div>
            <a
              href="/plans"
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              Ver planos
            </a>
          </div>
        )}

        <div className="mb-8 rounded-2xl bg-slate-900 text-white p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-850">
          <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-12 opacity-5 text-white pointer-events-none">
            <Plane className="h-48 w-48" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/15 border border-blue-500/30 px-3 py-1 text-xs text-blue-400 font-bold mb-3 tracking-wide">
              <Sparkles className="h-3 w-3" />
              Rastreador Inteligente Multi-Canais
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
              Monitore preços e compre sua passagem na hora certa!
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
              Configure sua rota e meta de preço — nós avisamos assim que o valor cair.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2 bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 self-start md:self-auto text-xs font-mono">
            <Server className="h-4 w-4 text-blue-500 animate-pulse" />
            <div>
              <p className="font-bold text-slate-250">Robô Crawler Online</p>
              <p className="text-[10px] text-slate-500">{sites.length} destinos mapeados</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-xs font-semibold">Carregando seus monitores...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-8">
              <MonitorForm airlineSites={sites} onSubmit={handleAddMonitor} currentUserEmail={currentUserEmail} />
              <SitesList sites={sites} onToggleSiteStatus={handleToggleSiteStatus} />
            </div>

            <div className="lg:col-span-2 space-y-8">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <Plane className="h-5 w-5 text-blue-600 transform rotate-45" />
                      Seus Alertas de Passagens
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">Rastreando preços entre cidades cadastradas</p>
                  </div>

                  <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-100/60 text-[11px] font-bold">
                    <button
                      onClick={() => setActiveTab('monitors')}
                      className={`px-3 py-1.5 rounded-md transition ${
                        activeTab === 'monitors' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900 font-semibold'
                      }`}
                    >
                      Alertas Ativos ({monitors.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('sites')}
                      className={`px-3 py-1.5 rounded-md transition ${
                        activeTab === 'sites' ? 'bg-white text-slate-900 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-900 font-semibold'
                      }`}
                    >
                      Histórico Geral ({notifications.length})
                    </button>
                  </div>
                </div>

                {activeTab === 'monitors' ? (
                  monitors.length === 0 ? (
                    <RadarEmptyState />
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
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
                  )
                ) : (
                  <NotificationFeed
                    notifications={notifications}
                    onOpenEmailPreview={setSelectedEmail}
                    onClearAll={handleClearNotifications}
                    onSendTestEmail={handleSendTestEmail}
                    userEmail={currentUserEmail}
                  />
                )}
              </div>

              {activeTab === 'monitors' && (
                <NotificationFeed
                  notifications={notifications}
                  onOpenEmailPreview={setSelectedEmail}
                  onClearAll={handleClearNotifications}
                  onSendTestEmail={handleSendTestEmail}
                  userEmail={currentUserEmail}
                />
              )}
            </div>
          </div>
        )}
      </main>

      <EmailModal notification={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </div>
  );
}
