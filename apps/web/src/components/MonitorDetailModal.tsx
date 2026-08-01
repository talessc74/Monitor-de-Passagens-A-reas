'use client';

import { X, TrendingDown, TrendingUp } from 'lucide-react';
import type { FlightMonitor } from '@mpa/types';
import { useEscapeToClose } from '../lib/useEscapeToClose';

interface MonitorDetailModalProps {
  monitor: FlightMonitor;
  onClose: () => void;
}

const SITE_NAMES: { [key: string]: string } = {
  latam: 'LATAM',
  gol: 'GOL',
  azul: 'Azul',
  decolar: 'Decolar',
  skyscanner: 'Skyscanner',
};

/**
 * Tela de histórico do monitor (screen 04 do mockup de UX aprovado):
 * preço grande, gráfico com linha de meta, estatísticas e preço por
 * site do último scan. Ver .xdrs/_local/bdrs/product/plans/001-...
 */
export default function MonitorDetailModal({ monitor, onClose }: MonitorDetailModalProps) {
  useEscapeToClose(onClose);

  const points = [...monitor.history];
  if (monitor.currentPrice) {
    points.push({ date: new Date().toISOString(), price: monitor.currentPrice, site: 'atual' });
  }

  const hasMargin = monitor.targetPriceMarginPercent > 0;
  const marginCeiling = monitor.targetPrice * (1 + monitor.targetPriceMarginPercent / 100);

  const hasHistory = points.length >= 2;
  const prices = points.map((p) => p.price);
  const minPrice = hasHistory ? Math.min(...prices, monitor.targetPrice) : monitor.targetPrice;
  const maxPrice = hasHistory
    ? Math.max(...prices, monitor.targetPrice, hasMargin ? marginCeiling : monitor.targetPrice)
    : monitor.targetPrice;
  const range = maxPrice - minPrice === 0 ? 1 : maxPrice - minPrice;

  const width = 400;
  const height = 140;
  const padding = 14;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const svgPoints = points
    .map((p, index) => {
      const x = padding + (index / (points.length - 1)) * chartWidth;
      const ratio = (p.price - minPrice) / range;
      const y = padding + chartHeight - ratio * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const targetRatio = (monitor.targetPrice - minPrice) / range;
  const targetY = padding + chartHeight - targetRatio * chartHeight;
  const marginRatio = (marginCeiling - minPrice) / range;
  const marginY = padding + chartHeight - marginRatio * chartHeight;

  const observedMin = hasHistory ? Math.min(...prices) : null;
  const observedAvg = hasHistory ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  const variation =
    hasHistory && prices.length >= 2 ? Math.round(((prices[prices.length - 1] - prices[0]) / prices[0]) * 100) : null;

  const sortedResults = monitor.lastScanResults ? [...monitor.lastScanResults].sort((a, b) => a.price - b.price) : [];

  const priceVsTarget =
    monitor.currentPrice !== null ? monitor.currentPrice - monitor.targetPrice : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-paper-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="monitor-detail-title"
      >
        <div className="mb-1 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              {monitor.origin} → {monitor.destination} · {monitor.trackedSites.map((s) => SITE_NAMES[s] || s).join(', ')}
            </p>
            <h2 id="monitor-detail-title" className="font-serif text-base font-semibold">
              {priceVsTarget !== null && priceVsTarget <= 0 ? 'Meta batida — hora de comprar' : 'Histórico de preço'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1 text-ink-muted transition hover:bg-paper-deep hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 text-center">
          <span className="font-mono text-3xl font-black">
            {monitor.currentPrice ? `R$ ${monitor.currentPrice.toLocaleString('pt-BR')}` : 'Sem leitura ainda'}
          </span>
          {priceVsTarget !== null && (
            <p className={`mt-1 flex items-center justify-center gap-1 text-xs font-bold ${priceVsTarget <= 0 ? 'text-teal' : 'text-ink-muted'}`}>
              {priceVsTarget <= 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {priceVsTarget <= 0
                ? `R$ ${Math.abs(priceVsTarget).toLocaleString('pt-BR')} abaixo da sua meta de R$ ${monitor.targetPrice.toLocaleString('pt-BR')}`
                : `R$ ${priceVsTarget.toLocaleString('pt-BR')} acima da sua meta de R$ ${monitor.targetPrice.toLocaleString('pt-BR')}`}
            </p>
          )}
        </div>

        {hasHistory ? (
          <div className="mt-4">
            <div className="mb-1 flex items-center gap-3 font-mono text-[9px] text-ink-muted">
              <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-2.5 bg-terracotta" /> preço (eixo Y) por data (eixo X)</span>
              <span className="flex items-center gap-1"><span className="inline-block h-0 w-2.5 border-t-2 border-dashed border-border-strong" /> meta</span>
              {hasMargin && (
                <span className="flex items-center gap-1"><span className="inline-block h-0 w-2.5 border-t-2 border-dashed border-amber" /> aviso (+{monitor.targetPriceMarginPercent}%)</span>
              )}
            </div>
            <svg className="w-full" viewBox={`0 0 ${width} ${height}`} height={height}>
              <defs>
                <linearGradient id={`detail-gradient-${monitor.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--color-terracotta)' }} stopOpacity="0.2" />
                  <stop offset="100%" style={{ stopColor: 'var(--color-terracotta)' }} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`M ${padding},${height} L ${svgPoints} L ${width - padding},${height} Z`} fill={`url(#detail-gradient-${monitor.id})`} />
              <line x1={padding} y1={targetY} x2={width - padding} y2={targetY} style={{ stroke: 'var(--color-border-strong)' }} strokeWidth="1.5" strokeDasharray="5 3" />
              {hasMargin && (
                <line x1={padding} y1={marginY} x2={width - padding} y2={marginY} style={{ stroke: 'var(--color-amber)' }} strokeWidth="1.5" strokeDasharray="5 3" />
              )}
              <polyline fill="none" style={{ stroke: 'var(--color-terracotta)' }} strokeWidth="2.5" points={svgPoints} strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border bg-paper-deep p-2 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-ink-muted">Mínima</span>
                <span className="font-mono text-sm font-extrabold">R$ {observedMin?.toLocaleString('pt-BR')}</span>
              </div>
              <div className="rounded-md border border-border bg-paper-deep p-2 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-ink-muted">Média</span>
                <span className="font-mono text-sm font-extrabold">R$ {observedAvg?.toLocaleString('pt-BR')}</span>
              </div>
              <div className="rounded-md border border-border bg-paper-deep p-2 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-ink-muted">Variação</span>
                <span className={`font-mono text-sm font-extrabold ${variation !== null && variation < 0 ? 'text-teal' : ''}`}>
                  {variation !== null ? `${variation > 0 ? '+' : ''}${variation}%` : '—'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-border bg-paper-deep p-4 text-center text-xs text-ink-muted">
            Ainda não há histórico suficiente. Rode uma varredura para começar a registrar preços.
          </p>
        )}

        {sortedResults.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Preço por site (último scan)</p>
            <div className="divide-y divide-border rounded-md border border-border">
              {sortedResults.map((r, i) => (
                <div key={r.site} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-ink-muted">
                    {SITE_NAMES[r.site] || r.site.toUpperCase()}
                    {r.estimated === false && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                        Real
                      </span>
                    )}
                  </span>
                  <span className={`font-mono font-bold ${i === 0 ? 'text-teal' : ''}`}>
                    R$ {r.price.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
