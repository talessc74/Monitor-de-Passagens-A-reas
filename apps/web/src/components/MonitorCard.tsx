'use client';

import { useState } from 'react';
import { Calendar, Users, DollarSign, RefreshCw, Trash2, Power, History, Sparkles } from 'lucide-react';
import type { FlightMonitor } from '@mpa/types';

interface MonitorCardProps {
  monitor: FlightMonitor;
  onScan: (id: string) => Promise<any>;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: string) => void;
}

const SITE_NAMES: { [key: string]: string } = {
  latam: 'LATAM',
  gol: 'GOL',
  azul: 'Azul',
  decolar: 'Decolar',
  skyscanner: 'Skyscanner',
};

export default function MonitorCard({ monitor, onScan, onDelete, onToggleStatus }: MonitorCardProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanSteps, setScanSteps] = useState<string[]>([]);
  const [scanResultText, setScanResultText] = useState('');

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
          setScanSteps((prev) => [...prev, '🚨 Alerta de preço disparado e enviado para ' + monitor.email + '!']);
        }
      }
    } catch (err: any) {
      setScanSteps((prev) => [...prev, '❌ Erro ao ler ofertas: ' + (err.message || 'Problema técnico.')]);
    } finally {
      setTimeout(() => setIsScanning(false), 2000);
    }
  };

  const renderSparkline = () => {
    const points = [...monitor.history];
    if (monitor.currentPrice) {
      points.push({ date: new Date().toISOString(), price: monitor.currentPrice, site: 'atual' });
    }

    if (points.length < 2) {
      return (
        <div className="flex h-24 flex-col items-center justify-center rounded-xl bg-zinc-50 border border-zinc-100 p-2 text-center text-xs text-zinc-400">
          <History className="h-4 w-4 mb-1 text-zinc-300" />
          <span>Sem histórico suficiente.</span>
          <span className="text-[10px] text-zinc-400">Clique em &quot;Varrer Agora&quot; para iniciar</span>
        </div>
      );
    }

    const prices = points.map((p) => p.price);
    const minPrice = Math.min(...prices, monitor.targetPrice);
    const maxPrice = Math.max(...prices, monitor.targetPrice);
    const range = maxPrice - minPrice === 0 ? 1 : maxPrice - minPrice;

    const width = 280;
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

    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-3">
        <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <History className="h-3 w-3" />
            Preço (eixo Y) por data (eixo X)
          </span>
          <span className="text-slate-600 font-semibold">
            Min: R$ {minPrice} / Max: R$ {maxPrice}
          </span>
        </div>
        <div className="mb-1.5 flex items-center gap-3 text-[9px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-2.5 bg-blue-600" /> preço
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0 w-2.5 border-t-2 border-dashed border-slate-400" /> meta (R$ {monitor.targetPrice})
          </span>
        </div>
        <div className="relative">
          <svg className="w-full" viewBox={`0 0 ${width} ${height}`} height={height}>
            <defs>
              <linearGradient id={`gradient-${monitor.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={`M ${padding},${height} L ${svgPoints} L ${width - padding},${height} Z`} fill={`url(#gradient-${monitor.id})`} />
            <line
              x1={padding}
              y1={targetY}
              x2={width - padding}
              y2={targetY}
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={svgPoints} strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, index) => {
              const x = padding + (index / (points.length - 1)) * chartWidth;
              const ratio = (p.price - minPrice) / range;
              const y = padding + chartHeight - ratio * chartHeight;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-white stroke-blue-600 stroke-2 cursor-help transition-all"
                >
                  <title>{`R$ ${p.price} (${new Date(p.date).toLocaleDateString()})`}</title>
                </circle>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  const isConfiguredUnderTarget = monitor.currentPrice && monitor.currentPrice <= monitor.targetPrice;

  const monitoringDays = monitor.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(monitor.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        isConfiguredUnderTarget ? 'border-emerald-200 bg-emerald-50/10 shadow-emerald-50' : 'border-slate-200'
      }`}
      id={`monitor-card-${monitor.id}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/50">
              {monitor.origin}
            </span>
            <span className="text-slate-400 text-xs">➔</span>
            <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
              {monitor.destination}
            </span>
            {isConfiguredUnderTarget && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                <Sparkles className="h-2.5 w-2.5" />
                Preço Alvo Atingido
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-base font-extrabold text-slate-800">
            {monitor.originCity} para {monitor.destinationCity}
          </h3>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
            <Calendar className="h-3.5 w-3.5" />
            {monitor.searchMode === 'dated' && monitor.departureDate && monitor.returnDate ? (
              <>
                {new Date(monitor.departureDate).toLocaleDateString('pt-BR')} a {new Date(monitor.returnDate).toLocaleDateString('pt-BR')}
                {(monitor.departDaysBefore || monitor.departDaysAfter || monitor.returnDaysBefore || monitor.returnDaysAfter) && (
                  <span className="text-slate-400">
                    {' '}(flexível: ida −{monitor.departDaysBefore ?? 0}/+{monitor.departDaysAfter ?? 0}, volta −{monitor.returnDaysBefore ?? 0}/+{monitor.returnDaysAfter ?? 0})
                  </span>
                )}
              </>
            ) : (
              <span>Qualquer data · só o preço importa</span>
            )}
          </p>
        </div>

        <div className="flex items-baseline gap-2 self-start rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
          <div className="text-right">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Menor Valor Lido</span>
            <span className="text-lg font-black text-slate-850">{monitor.currentPrice ? `R$ ${monitor.currentPrice}` : 'N/D'}</span>
          </div>
          <div className="border-l border-slate-200 pl-2 text-right">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Meta Desejada</span>
            <span className="text-xs font-bold text-blue-600">R$ {monitor.targetPrice}</span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-slate-400" />
          <span>
            {monitor.adults} {monitor.adults === 1 ? 'Adulto' : 'Adultos'}
            {monitor.children > 0 && `, ${monitor.children} ${monitor.children === 1 ? 'Criança' : 'Crianças'}`}
            {monitor.infants > 0 && ` e ${monitor.infants} ${monitor.infants === 1 ? 'Bebê' : 'Bebês'}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-slate-400" />
          <span>Sites:</span>
          <div className="flex gap-1 flex-wrap font-bold">
            {monitor.trackedSites.map((s) => (
              <span key={s} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] border border-slate-200/50">
                {SITE_NAMES[s] || s.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">{renderSparkline()}</div>

      {isScanning && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[10px] text-blue-400 max-h-36 overflow-y-auto shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5 text-slate-500 text-[9px] uppercase tracking-wider">
            <span>Console do Robô Crawler</span>
            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
          </div>
          <div className="space-y-1">
            {scanSteps.map((step, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                <span className={step.includes('❌') ? 'text-red-400' : step.includes('🚨') ? 'text-emerald-400 font-semibold' : ''}>{step}</span>
              </div>
            ))}
            {scanResultText && (
              <p className="text-white font-bold mt-1 bg-blue-950 px-1 py-0.5 rounded border border-blue-900">✔ {scanResultText}</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-150 pt-3">
        <div className="text-[10px] text-slate-400 font-medium">
          Última Verificação:{' '}
          <span className="font-bold text-slate-500">
            {monitor.lastScannedAt ? new Date(monitor.lastScannedAt).toLocaleTimeString('pt-BR') : 'Ainda não verificado'}
          </span>
          {monitor.status === 'active' && monitoringDays !== null && (
            <span className="ml-2 text-slate-400">
              · monitorando há {monitoringDays === 0 ? 'menos de 1 dia' : monitoringDays === 1 ? '1 dia' : `${monitoringDays} dias`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onToggleStatus(monitor.id, monitor.status)}
            className={`p-2 rounded-lg border text-xs transition ${
              monitor.status === 'active'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
            title={monitor.status === 'active' ? 'Pausar Monitoramento' : 'Ativar de volta'}
          >
            <Power className="h-4 w-4" />
          </button>

          <button
            onClick={handleScanClick}
            disabled={isScanning || monitor.status !== 'active'}
            className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 disabled:border-slate-200 text-white border-0 text-xs font-bold px-3.5 py-1.5 shadow-sm shadow-blue-100 transition"
          >
            <RefreshCw className={`h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} />
            Varre Agora
          </button>

          <button
            onClick={() => onDelete(monitor.id)}
            className="p-2 rounded-lg border border-red-150 bg-red-50 text-red-600 hover:bg-red-100 transition"
            title="Excluir Alerta"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
