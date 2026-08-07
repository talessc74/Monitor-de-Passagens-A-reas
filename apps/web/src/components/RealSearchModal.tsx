'use client';

import { useEffect, useState } from 'react';
import { X, Globe, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { FlightMonitor } from '@mpa/types';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { apiFetch } from '../lib/api';

interface RealSearchModalProps {
  monitor: FlightMonitor;
  onClose: () => void;
}

interface RealSearchResponse {
  success: boolean;
  price: number | null;
  currency: 'BRL';
  searchUrl: string;
  pageTitle?: string;
  error?: string;
  screenshotBase64?: string;
}

/**
 * "Buscar preço real agora" — abre um navegador de verdade (services/
 * scraper) só neste clique, nunca em loop automático. Ver
 * _local-bdr-policy-015.
 */
export default function RealSearchModal({ monitor, onClose }: RealSearchModalProps) {
  useEscapeToClose(onClose);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RealSearchResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(`/api/monitors/${monitor.id}/real-search`, { method: 'POST' });
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(data?.error || 'Não foi possível buscar o preço real agora.');
        } else {
          setResult(data as RealSearchResponse);
        }
      } catch {
        if (!cancelled) setError('Erro de rede ao buscar o preço real.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitor.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/60 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-paper-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="real-search-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="real-search-title" className="flex items-center gap-1.5 font-serif text-base font-semibold">
            <Globe className="h-4 w-4 text-terracotta" />
            Preço real agora
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1 text-ink-muted transition hover:bg-paper-deep hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-xs text-ink-muted">
          {monitor.origin} → {monitor.destination} · abrindo um navegador de verdade no Skyscanner, isso pode levar até 30
          segundos.
        </p>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-paper-deep p-6 text-xs text-ink-muted">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-terracotta border-t-transparent" />
            Buscando preço real...
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg p-3 text-xs text-danger-text">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {!loading && result && (
          <div className="space-y-3">
            {result.success && result.price !== null ? (
              <div className="rounded-md border border-teal/40 bg-teal/10 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-teal">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Preço real encontrado
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-ink">
                  R$ {result.price.toLocaleString('pt-BR')}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-amber/40 bg-amber/10 p-3 text-xs text-ink">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
                {result.error || 'Não conseguimos ler um preço automaticamente desta vez.'}
              </div>
            )}

            {!result.success && result.screenshotBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${result.screenshotBase64}`}
                alt="Captura da página no momento da falha de leitura do preço"
                className="w-full rounded-md border border-border"
              />
            )}

            <a
              href={result.searchUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-xs font-bold text-ink-muted transition hover:bg-paper-deep"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir busca no Skyscanner
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
