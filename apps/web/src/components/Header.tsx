'use client';

import { Plane, Bell, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

interface HeaderProps {
  activeMonitorsCount: number;
  notificationsCount: number;
}

export default function Header({ activeMonitorsCount, notificationsCount }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-zinc-100 bg-white" id="app-header">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-auto min-h-16 flex-wrap items-center justify-between gap-y-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-100">
              <Plane className="h-4.5 w-4.5 transform rotate-45" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-800">
                Fly<span className="text-blue-600 underline decoration-2 underline-offset-4 font-black">Spot</span>
              </h1>
              <p className="hidden text-[10px] font-semibold text-slate-400 uppercase tracking-wider sm:block">
                Varredura Inteligente & Alertas Ativos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 md:flex font-medium">
              <Shield className="h-3.5 w-3.5 text-slate-400" />
              <span>Plataforma</span>
              <span className="font-mono bg-slate-200/80 px-1 py-0.5 rounded text-slate-700">Gemini AI</span>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 border border-blue-100">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              <span className="font-bold">
                {activeMonitorsCount} <span className="hidden sm:inline">Alertas Ativos</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600 py-1.5 px-1 text-xs font-semibold">
              <Bell className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Notificações:</span>
              <span className="font-black text-slate-800">{notificationsCount}</span>
              <span className="hidden sm:inline text-slate-400">mensagens</span>
            </div>

            {user && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-4">
                <a
                  href="/plans"
                  className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
                >
                  Planos
                </a>
                <a
                  href="/profile"
                  className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
                  title={user.email ?? ''}
                >
                  Perfil
                </a>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 transition"
                  title="Sair"
                  aria-label="Sair da conta"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
