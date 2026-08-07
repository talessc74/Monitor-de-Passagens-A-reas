'use client';

import { useState } from 'react';
import { Calendar, Users, RefreshCw, Trash2, Power, History, Pencil, Route, Globe } from 'lucide-react';
import type { AirlineSite, FlightMonitor } from '@mpa/types';
import EditMonitorModal from './EditMonitorModal';
import MonitorDetailModal from './MonitorDetailModal';
import RealSearchModal from './RealSearchModal';

interface MonitorCardProps {
  monitor: FlightMonitor;
  airlineSites: AirlineSite[];
  onScan: (id: string) => Promise<any>;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
  onEdit: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  isPro: boolean;
}

const SITE_NAMES: { [key: string]: string } = {
  latam: 'LATAM',
  gol: 'GOL',
  azul: 'Azul',
  decolar: 'Decolar',
  skyscanner: 'Skyscanner',
};

export default function MonitorCard({ monitor, airlineSites, onScan, onDelete, onToggleStatus, onEdit, isPro }: MonitorCardProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanSteps, setScanSteps] = useState<string[]>([]);
  const [scanResultText, setScanResultText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isViewingDetail, setIsViewingDetail] = useState(false);
  const [isRealSearching, setIsRealSearching] = useState(false);

  const handleScanClick = async () => {
    setIsScanning(true);
    setScanSteps([]);
    setScanResultText('');

    const steps = [
      'Iniciando varredura automatizada...',
      `Consultando parametrizações para trecho ${monitor.origin} ➔ ${monitor.destination}...`,
      `Conectando com segurança aos servidores selecionados... (${monitor.trackedSites.map((s) => s.toUpperCase()).join(', ')})`,
      'Enviando dados estruturados ao robô de inteligência...',
      'Extraindo tarifas vigentes usando processamento semântico...',
      'Processando menor tarifa encontrada...',
    ];

    for (let i = 0; i < steps.length; i++) {
      setScanSteps((prev) => [...prev, steps[i]]);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    try {
      const res = await onScan(monitor.id);
      if (res && res.success) {
        setScanResultText(`Varredura concluída! Menor preço encontrado: R$ ${res.cheapestResult.price} (${res.cheapestResult.site.toUpperCase()}).`);
        if (res.triggeredNotification) {
          setScanSteps((prev) => [...prev, 'Alerta de preço disparado e enviado para ' + monitor.email + '!']);
        }
      }
    } catch (err: any) {
      setScanSteps((prev) => [...prev, 'Erro ao ler ofertas: ' + (err.message || 'Problema técnico.')]);
    } finally {
      setTimeout(() => setIsScanning(false), 2000);
    }
  };

  const isConfiguredUnderTarget = !!(monitor.currentPrice && monitor.currentPrice <= monitor.targetPrice);

  const cheapestLastResult =
    monitor.lastScanResults && monitor.lastScanResults.length > 0
      ? [...monitor.lastScanResults].sort((a, b) => a.price - b.price)[0]
      : null;

  const monitoringDays = monitor.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(monitor.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-paper-card shadow-card ${
        isConfiguredUnderTarget ? 'border-teal/30' : 'border-border'
      }`}
      id={`monitor-card-${monitor.id}`}
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">FlySpot · Alerta</span>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            monitor.status !== 'active'
              ? 'border-border-strong text-ink-muted'
              : isConfiguredUnderTarget
                ? 'border-teal text-teal'
                : 'border-terracotta text-terracotta'
          }`}
        >
          {monitor.status !== 'active' ? 'Pausado' : isConfiguredUnderTarget ? 'Meta atingida' : 'Aguardando'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-2.5">
        <div>
          <div className="font-mono text-2xl font-bold leading-none sm:text-[26px]">{monitor.origin}</div>
          <div className="mt-1 text-[11px] text-ink-muted">{monitor.originCity}</div>
        </div>
        <div className="relative top-[-8px] mx-2 hidden h-px flex-1 bg-[repeating-linear-gradient(to_right,var(--color-border-strong)_0_6px,transparent_6px_11px)] sm:block" />
        <div className="hidden max-w-[40%] text-center text-[11px] leading-tight text-ink-muted sm:block">
          {monitor.searchMode === 'dated' && monitor.departureDate && monitor.returnDate ? (
            <>
              {new Date(monitor.departureDate).toLocaleDateString('pt-BR')} — {new Date(monitor.returnDate).toLocaleDateString('pt-BR')}
              {(monitor.departDaysBefore || monitor.departDaysAfter || monitor.returnDaysBefore || monitor.returnDaysAfter) && (
                <span className="block text-ink-muted/80">
                  flexível: ida −{monitor.departDaysBefore ?? 0}/+{monitor.departDaysAfter ?? 0}, volta −{monitor.returnDaysBefore ?? 0}/+{monitor.returnDaysAfter ?? 0}
                </span>
              )}
            </>
          ) : (
            'Qualquer data'
          )}
        </div>
        <div className="relative top-[-8px] mx-2 hidden h-px flex-1 bg-[repeating-linear-gradient(to_right,var(--color-border-strong)_0_6px,transparent_6px_11px)] sm:block" />
        <div className="text-right">
          <div className="font-mono text-2xl font-bold leading-none sm:text-[26px]">{monitor.destination}</div>
          <div className="mt-1 text-[11px] text-ink-muted">{monitor.destinationCity}</div>
        </div>
      </div>

      {monitor.searchMode !== 'dated' && (
        <div className="mx-5 mb-4 flex items-start gap-2 rounded-md border border-border bg-paper-deep p-3 text-xs text-ink-muted">
          <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" />
          Qualquer data · só o preço importa
        </div>
      )}

      {monitor.lastItineraryLegs && monitor.lastItineraryLegs.length > 0 && (
        <button
          onClick={() => setIsViewingDetail(true)}
          className="mx-5 mb-4 flex w-[calc(100%-2.5rem)] items-center gap-2 rounded-md border border-terracotta/30 bg-terracotta-wash p-3 text-left text-xs text-ink transition hover:brightness-95"
        >
          <Route className="h-3.5 w-3.5 shrink-0 text-terracotta" />
          <span>
            <strong className="font-bold text-terracotta">Itinerário multi-trecho mais barato</strong> encontrado — veja o
            roteiro no histórico
          </span>
        </button>
      )}

      <div className="relative mx-5 border-t-2 border-dashed border-border">
        <span className="absolute -left-[29px] -top-[9px] h-[18px] w-[18px] rounded-full bg-paper" aria-hidden="true" />
        <span className="absolute -right-[29px] -top-[9px] h-[18px] w-[18px] rounded-full bg-paper" aria-hidden="true" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-muted">
            Menor lido
            {cheapestLastResult &&
              (cheapestLastResult.estimated === false ? (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                  Real
                </span>
              ) : (
                <span className="rounded bg-paper-deep px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                  Simulado
                </span>
              ))}
          </div>
          <div className={`font-mono text-xl font-bold sm:text-2xl ${isConfiguredUnderTarget ? 'text-teal' : 'text-terracotta'}`}>
            {monitor.currentPrice ? `R$ ${monitor.currentPrice.toLocaleString('pt-BR')}` : 'N/D'}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-muted">Meta</div>
          <div className="font-mono text-sm font-bold text-ink-muted">R$ {monitor.targetPrice.toLocaleString('pt-BR')}</div>
          {monitor.targetPriceMarginPercent > 0 && (
            <div className="mt-0.5 text-[10px] text-amber">
              aviso até R$ {Math.round(monitor.targetPrice * (1 + monitor.targetPriceMarginPercent / 100)).toLocaleString('pt-BR')} (+{monitor.targetPriceMarginPercent}%)
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-border px-5 py-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-ink-muted" />
          {monitor.adults} {monitor.adults === 1 ? 'adulto' : 'adultos'}
          {monitor.children > 0 && `, ${monitor.children} ${monitor.children === 1 ? 'criança' : 'crianças'}`}
          {monitor.infants > 0 && ` e ${monitor.infants} ${monitor.infants === 1 ? 'bebê' : 'bebês'}`}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {monitor.trackedSites.map((s) => (
            <span key={s} className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
              {(SITE_NAMES[s] || s.toUpperCase()).toUpperCase()}
            </span>
          ))}
        </span>
      </div>

      <MonitorSparkline monitor={monitor} />

      {isScanning && (
        <div className="mx-5 mb-4 max-h-36 overflow-y-auto rounded-md border border-ink-strong bg-ink-strong p-3 font-mono text-[10px] text-paper-on-ink shadow-inner">
          <div className="mb-1.5 flex items-center justify-between border-b border-white/10 pb-1.5 text-[9px] uppercase tracking-wider text-paper-on-ink-muted">
            <span>Console do robô crawler</span>
            <RefreshCw className="h-3 w-3 animate-spin text-terracotta-tint" />
          </div>
          <div className="space-y-1">
            {scanSteps.map((step, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-paper-on-ink-muted">[{new Date().toLocaleTimeString()}]</span>
                <span className={step.includes('Erro') ? 'text-red-300' : step.includes('disparado') ? 'font-semibold text-teal' : ''}>{step}</span>
              </div>
            ))}
            {scanResultText && (
              <p className="mt-1 rounded border border-teal/40 bg-teal/10 px-1.5 py-0.5 font-bold text-paper-on-ink">✔ {scanResultText}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[10px] text-ink-muted">
          Última verificação: <span className="font-bold text-ink">{monitor.lastScannedAt ? new Date(monitor.lastScannedAt).toLocaleTimeString('pt-BR') : 'Ainda não verificado'}</span>
          {monitor.status === 'active' && monitoringDays !== null && (
            <span className="ml-2">
              · monitorando há {monitoringDays === 0 ? 'menos de 1 dia' : monitoringDays === 1 ? '1 dia' : `${monitoringDays} dias`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setIsViewingDetail(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-strong bg-paper text-ink-muted transition hover:bg-paper-deep"
            title="Ver histórico"
            aria-label="Ver histórico do monitor"
          >
            <History className="h-4 w-4" />
          </button>

          <button
            onClick={() => setIsEditing(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-strong bg-paper text-ink-muted transition hover:bg-paper-deep"
            title="Editar alerta"
            aria-label="Editar alerta"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            onClick={() => onToggleStatus(monitor.id, monitor.status)}
            className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${
              monitor.status === 'active'
                ? 'border-teal/40 bg-teal/10 text-teal hover:bg-teal/20'
                : 'border-border-strong bg-paper text-ink-muted hover:bg-paper-deep'
            }`}
            title={monitor.status === 'active' ? 'Pausar Monitoramento' : 'Ativar de volta'}
            aria-label={monitor.status === 'active' ? 'Pausar monitoramento' : 'Ativar monitoramento de volta'}
          >
            <Power className="h-4 w-4" />
          </button>

          <button
            onClick={handleScanClick}
            disabled={isScanning || monitor.status !== 'active'}
            className="flex items-center gap-1.5 rounded-md bg-terracotta-solid px-3.5 py-2 text-xs font-bold text-white transition hover:bg-terracotta-hover disabled:bg-paper-deep disabled:text-ink-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            Varrer agora
          </button>

          <button
            onClick={() => setIsRealSearching(true)}
            className="flex items-center gap-1.5 rounded-md border border-terracotta/40 bg-terracotta-wash px-3.5 py-2 text-xs font-bold text-terracotta transition hover:brightness-95"
            title="Abrir um navegador de verdade e buscar o preço real agora"
          >
            <Globe className="h-3.5 w-3.5" />
            Preço real agora
          </button>

          <button
            onClick={() => {
              if (window.confirm(`Excluir o alerta ${monitor.origin} → ${monitor.destination}? O histórico de preços será perdido.`)) {
                onDelete(monitor.id);
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-danger-border bg-danger-bg text-danger-icon transition hover:bg-danger-border/40"
            title="Excluir Alerta"
            aria-label="Excluir alerta"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isEditing && (
        <EditMonitorModal
          monitor={monitor}
          airlineSites={airlineSites}
          onClose={() => setIsEditing(false)}
          onSave={onEdit}
          isPro={isPro}
        />
      )}

      {isViewingDetail && <MonitorDetailModal monitor={monitor} onClose={() => setIsViewingDetail(false)} />}

      {isRealSearching && <RealSearchModal monitor={monitor} onClose={() => setIsRealSearching(false)} />}
    </div>
  );
}

function MonitorSparkline({ monitor }: { monitor: FlightMonitor }) {
  const points = [...monitor.history];
  if (monitor.currentPrice) {
    points.push({ date: new Date().toISOString(), price: monitor.currentPrice, site: 'atual' });
  }

  if (points.length < 2) {
    return (
      <div className="mx-5 mb-4 flex h-20 flex-col items-center justify-center rounded-md border border-border bg-paper-deep p-2 text-center text-xs text-ink-muted">
        <History className="mb-1 h-4 w-4 text-ink-muted" />
        <span>Sem histórico suficiente.</span>
        <span className="text-[10px] text-ink-muted/80">Clique em &quot;Varrer Agora&quot; para iniciar</span>
      </div>
    );
  }

  const marginCeiling = monitor.targetPrice * (1 + monitor.targetPriceMarginPercent / 100);
  const hasMargin = monitor.targetPriceMarginPercent > 0;

  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices, monitor.targetPrice);
  const maxPrice = Math.max(...prices, monitor.targetPrice, hasMargin ? marginCeiling : monitor.targetPrice);
  const range = maxPrice - minPrice === 0 ? 1 : maxPrice - minPrice;

  const width = 400;
  const height = 60;
  const padding = 10;
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

  const lineColorVar = monitor.currentPrice && monitor.currentPrice <= monitor.targetPrice ? 'var(--color-teal)' : 'var(--color-terracotta)';

  return (
    <div className="mx-5 mb-4 rounded-md border border-border bg-paper p-3">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-ink-muted">
        <span>preço nos últimos dias</span>
        <span>min R$ {minPrice.toLocaleString('pt-BR')} · max R$ {maxPrice.toLocaleString('pt-BR')}</span>
      </div>
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`} height={height} preserveAspectRatio="none">
        <line x1={padding} y1={targetY} x2={width - padding} y2={targetY} style={{ stroke: 'var(--color-border-strong)' }} strokeWidth="1" strokeDasharray="4 3" />
        {hasMargin && (
          <line x1={padding} y1={marginY} x2={width - padding} y2={marginY} style={{ stroke: 'var(--color-amber)' }} strokeWidth="1" strokeDasharray="4 3" />
        )}
        <polyline fill="none" style={{ stroke: lineColorVar }} strokeWidth="2" points={svgPoints} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, index) => {
          const x = padding + (index / (points.length - 1)) * chartWidth;
          const ratio = (p.price - minPrice) / range;
          const y = padding + chartHeight - ratio * chartHeight;
          return (
            <circle key={index} cx={x} cy={y} r="3" style={{ fill: 'var(--color-paper-card)', stroke: lineColorVar }} strokeWidth="2">
              <title>{`R$ ${p.price.toLocaleString('pt-BR')} (${new Date(p.date).toLocaleDateString('pt-BR')})`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
