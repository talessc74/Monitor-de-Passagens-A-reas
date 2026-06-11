/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import Header from "./components/Header";
import MonitorForm from "./components/MonitorForm";
import MonitorCard from "./components/MonitorCard";
import SitesList from "./components/SitesList";
import NotificationFeed from "./components/NotificationFeed";
import EmailModal from "./components/EmailModal";
import { FlightMonitor, AirlineSite, NotificationLog } from "./types";
import { Plane, Info, ShieldAlert, Sparkles, Server, RefreshCw } from "lucide-react";

export default function App() {
  const [monitors, setMonitors] = useState<FlightMonitor[]>([]);
  const [sites, setSites] = useState<AirlineSite[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [activeTab, setActiveTab] = useState<"monitors" | "sites">("monitors");
  const [selectedEmail, setSelectedEmail] = useState<NotificationLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // D-02: email não pode ser hardcoded — o usuário preenche no formulário (BLAST / SOVEREIGN)
  const CURRENT_USER_EMAIL = "";

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [monitorsRes, sitesRes, notificationsRes] = await Promise.all([
        fetch("/api/monitors"),
        fetch("/api/sites"),
        fetch("/api/notifications"),
      ]);

      if (!monitorsRes.ok || !sitesRes.ok || !notificationsRes.ok) {
        throw new Error("Erro de resposta do servidor back-end");
      }

      const monitorsData = await monitorsRes.json();
      const sitesData = await sitesRes.json();
      const notificationsData = await notificationsRes.json();

      setMonitors(monitorsData);
      setSites(sitesData);
      setNotifications(notificationsData);
    } catch (err: any) {
      console.error("Falha ao recuperar dados:", err);
      setErrorMessage("Não foi possível conectar ao servidor de passagens aéreas. Verifique se o backend está de pé.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add new travel search monitor alert
  const handleAddMonitor = async (payload: any): Promise<boolean> => {
    setErrorMessage("");
    try {
      const response = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Falha ao cadastrar seu alerta de passagens");
      }

      const newMon = await response.json();
      setMonitors((prev) => [newMon, ...prev]);

      // Automatically trigger an immediate initial scan to get initial flight prices right away!
      handleScanMonitor(newMon.id);

      return true;
    } catch (err: any) {
      setErrorMessage(err.message || "Erro desconhecido ao cadastrar.");
      return false;
    }
  };

  // Trigger simulated scan for a specific monitor
  const handleScanMonitor = async (id: string): Promise<any> => {
    try {
      const response = await fetch(`/api/monitors/${id}/scan`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Erro na solicitação de escaneamento");
      }

      const data = await response.json();
      if (data && data.success) {
        // Update local monitors state
        setMonitors((prev) =>
          prev.map((m) => (m.id === id ? data.monitor : m))
        );

        // Fetch notifications again to update the alerts list
        const notifRes = await fetch("/api/notifications");
        if (notifRes.ok) {
          const freshNotifications = await notifRes.json();
          setNotifications(freshNotifications);
        }

        // Fetch sites statistical updates
        const sitesRes = await fetch("/api/sites");
        if (sitesRes.ok) {
          const freshSites = await sitesRes.json();
          setSites(freshSites);
        }
      }
      return data;
    } catch (err: any) {
      console.error("Erro no escaneamento síncrono:", err);
      throw err;
    }
  };

  // Delete monitor
  const handleDeleteMonitor = async (id: string) => {
    try {
      const response = await fetch(`/api/monitors/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMonitors((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error("Erro ao deletar monitor:", err);
    }
  };

  // Toggle active / paused status on a monitor
  const handleToggleMonitorStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const response = await fetch(`/api/monitors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (response.ok) {
        const updated = await response.json();
        setMonitors((prev) =>
          prev.map((m) => (m.id === id ? updated : m))
        );
      }
    } catch (err) {
      console.error("Erro ao alterar status do monitor:", err);
    }
  };

  // Toggle Airline site active state
  const handleToggleSiteStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/sites/${id}/toggle`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSites((prev) =>
            prev.map((s) => (s.id === id ? data.site : s))
          );
        }
      }
    } catch (err) {
      console.error("Erro ao alterar status do site:", err);
    }
  };

  // Clear notifications log
  const handleClearNotifications = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
      });

      if (response.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error("Erro ao limpar avisos:", err);
    }
  };

  // Direct manual test simulation
  const handleSendTestEmail = async (to: string, subject: string, content: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, content }),
      });

      if (response.ok) {
        // Refresh notifications
        const notifRes = await fetch("/api/notifications");
        if (notifRes.ok) {
          const freshNotifs = await notifRes.json();
          setNotifications(freshNotifs);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao disparar e-mail de teste:", err);
      return false;
    }
  };

  const activeMonitorsCount = monitors.filter((m) => m.status === "active").length;

  return (
    <div className="min-h-screen bg-slate-55 pb-16 font-sans antialiased text-slate-900" id="app-container">
      {/* App Header */}
      <Header activeMonitorsCount={activeMonitorsCount} notificationsCount={notifications.length} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Error alerting banner */}
        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <span className="font-bold">Ocorreu um problema:</span> {errorMessage}
            </div>
          </div>
        )}

        {/* Global info banner */}
        <div className="mb-8 rounded-2xl bg-slate-900 text-white p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-850">
          <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-12 opacity-5 text-white pointer-events-none">
            <Plane className="h-48 w-48" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/15 border border-blue-500/30 px-3 py-1 text-xs text-blue-400 font-bold mb-3 tracking-wide">
              <Sparkles className="h-3 w-3 text-blue-450" />
              Rastreador Inteligente Multi-Canais
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
              Monitore preços e compre sua passagem na hora certa!
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
              Nosso sistema vasculha as principais plataformas aéreas para o período de viagem selecionado, calculando passagens para adultos e crianças. Defina sua meta por e-mail e seja informado assim que o valor for menor ou igual à sua meta.
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

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 py-12 text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-xs font-semibold">Carregando base de dados e conectando ao robô...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column - Configure Forms and site lists */}
            <div className="lg:col-span-1 space-y-8">
              {/* Monitoring configuration form */}
              <MonitorForm
                airlineSites={sites}
                onSubmit={handleAddMonitor}
                currentUserEmail={CURRENT_USER_EMAIL}
              />

              {/* Monitored Airline targets list directory */}
              <SitesList
                sites={sites}
                onToggleSiteStatus={handleToggleSiteStatus}
              />
            </div>

            {/* Right Columns - Monitors list cards & notification channels */}
            <div className="lg:col-span-2 space-y-8">
              {/* Monitors section */}
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
                      onClick={() => setActiveTab("monitors")}
                      className={`px-3 py-1.5 rounded-md transition ${
                        activeTab === "monitors"
                          ? "bg-white text-slate-900 shadow-sm font-extrabold"
                          : "text-slate-500 hover:text-slate-900 font-semibold"
                      }`}
                    >
                      Alertas Ativos ({monitors.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("sites")}
                      className={`px-3 py-1.5 rounded-md transition ${
                        activeTab === "sites"
                          ? "bg-white text-slate-900 shadow-sm font-extrabold"
                          : "text-slate-500 hover:text-slate-900 font-semibold"
                      }`}
                    >
                      Histórico Geral ({notifications.length})
                    </button>
                  </div>
                </div>

                {activeTab === "monitors" ? (
                  monitors.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
                      <Plane className="h-8 w-8 stroke-slate-300 mx-auto mb-3 transform rotate-45 text-slate-400" />
                      <h3 className="font-bold text-slate-800 text-sm">Nenhum monitor configurado</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto font-medium">
                        Use o painel lateral para definir o local de partida, datas prováveis, acompanhantes e preço alvo para que o robô comece a vasculhar.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {monitors.map((monitor) => (
                        <MonitorCard
                           key={monitor.id}
                           monitor={monitor}
                           onScan={handleScanMonitor}
                           onDelete={handleDeleteMonitor}
                           onToggleStatus={handleToggleMonitorStatus}
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
                    userEmail={CURRENT_USER_EMAIL}
                  />
                )}
              </div>

              {/* D-06: NotificationFeed removido daqui — aparece apenas na aba "Histórico Geral" (POLARBEAR) */}
            </div>
          </div>
        )}
      </main>

      {/* D-08: EmailModal com callback de descadastro funcional (SOVEREIGN) */}
      <EmailModal
        notification={selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onUnsubscribe={(monitorId) => {
          const monitor = monitors.find((m) => m.id === monitorId);
          if (monitor) handleToggleMonitorStatus(monitorId, monitor.status);
          setSelectedEmail(null);
        }}
      />
    </div>
  );
}
