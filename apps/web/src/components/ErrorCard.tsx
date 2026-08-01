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
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-bold text-red-800">Não conseguimos consultar os preços agora</p>
          <p className="mt-0.5 text-xs text-red-700">{message} Vamos tentar de novo automaticamente em alguns minutos. Nenhum dado do seu monitor foi perdido.</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="mt-3 flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
        {retrying ? 'Tentando de novo...' : 'Tentar novamente agora'}
      </button>
    </div>
  );
}
