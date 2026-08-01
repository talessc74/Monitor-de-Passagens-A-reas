'use client';

import { ShieldAlert, RefreshCw } from 'lucide-react';

interface ErrorCardProps {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

/**
 * Erro amigável (screen 05 do mockup de UX aprovado): mensagem clara
 * do que aconteceu, sem jargão técnico, com ação de retry explícita.
 */
export default function ErrorCard({ message, onRetry, retrying }: ErrorCardProps) {
  return (
    <div className="mb-6 rounded-xl border border-danger-border bg-danger-bg p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-danger-icon" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-bold text-danger-text">Não conseguimos consultar os preços agora</p>
          <p className="mt-0.5 text-xs text-danger-text">{message} Vamos tentar de novo automaticamente em alguns minutos. Nenhum dado do seu monitor foi perdido.</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="mt-3 flex items-center gap-1.5 rounded-md border border-danger-border-strong bg-paper-card px-3 py-1.5 text-xs font-bold text-danger-text transition hover:bg-danger-border/30 disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
        {retrying ? 'Tentando de novo...' : 'Tentar novamente agora'}
      </button>
    </div>
  );
}
