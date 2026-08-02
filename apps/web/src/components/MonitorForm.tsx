'use client';

import { useEffect, useState } from 'react';
import { Calendar, CalendarX, DollarSign, Mail, Plus, TrendingUp } from 'lucide-react';
import type { AirlineSite, RouteStats } from '@mpa/types';
import { apiFetch } from '../lib/api';
import { findAirport } from '../lib/airports';
import AirportAutocomplete from './AirportAutocomplete';
import MarginPresetControl from './MarginPresetControl';

interface MonitorFormProps {
  airlineSites: AirlineSite[];
  onSubmit: (data: any) => Promise<boolean>;
  currentUserEmail: string;
}

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 7, 10, 15];

const inputClass =
  'w-full rounded-md border border-border-strong bg-paper px-3 py-2 text-sm font-bold text-ink font-mono focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta';
const plainInputClass =
  'w-full rounded-md border border-border-strong bg-paper px-3 py-2 text-sm font-medium text-ink font-sans focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta';
const selectClass =
  'w-full rounded-md border border-border-strong bg-paper-card px-2 py-1.5 text-xs font-bold text-ink focus:border-terracotta focus:outline-none';
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-muted';

export default function MonitorForm({ airlineSites, onSubmit, currentUserEmail }: MonitorFormProps) {
  const [searchMode, setSearchMode] = useState<'dated' | 'anytime'>('dated');
  const [origin, setOrigin] = useState('GRU');
  const [destination, setDestination] = useState('LIS');
  const [departureDate, setDepartureDate] = useState('2026-10-12');
  const [departDaysBefore, setDepartDaysBefore] = useState(2);
  const [departDaysAfter, setDepartDaysAfter] = useState(3);
  const [returnDate, setReturnDate] = useState('2026-10-26');
  const [returnDaysBefore, setReturnDaysBefore] = useState(2);
  const [returnDaysAfter, setReturnDaysAfter] = useState(3);
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [infants, setInfants] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<string>('4000');
  const [targetPriceMarginPercent, setTargetPriceMarginPercent] = useState<number>(0);
  const [email, setEmail] = useState(currentUserEmail);
  const [selectedSites, setSelectedSites] = useState<string[]>(['latam', 'gol', 'azul', 'decolar']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    const o = origin.toUpperCase().trim();
    const d = destination.toUpperCase().trim();
    if (o.length < 3 || d.length < 3) {
      setRouteStats(null);
      return;
    }
    if (searchMode === 'dated' && (!departureDate || !returnDate)) {
      setRouteStats(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setStatsLoading(true);
      try {
        const params = new URLSearchParams({
          origin: o,
          destination: d,
          searchMode,
          adults: String(adults),
          children: String(children),
          infants: String(infants),
        });
        if (searchMode === 'dated') {
          params.set('departureDate', departureDate);
          params.set('departDaysBefore', String(departDaysBefore));
          params.set('departDaysAfter', String(departDaysAfter));
          params.set('returnDate', returnDate);
          params.set('returnDaysBefore', String(returnDaysBefore));
          params.set('returnDaysAfter', String(returnDaysAfter));
        }
        const response = await apiFetch(`/api/route-stats?${params.toString()}`);
        if (response.ok) {
          setRouteStats(await response.json());
        }
      } catch (err) {
        console.error('Erro ao buscar histórico de preço da rota:', err);
      } finally {
        setStatsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [
    searchMode,
    origin,
    destination,
    departureDate,
    departDaysBefore,
    departDaysAfter,
    returnDate,
    returnDaysBefore,
    returnDaysAfter,
    adults,
    children,
    infants,
  ]);

  const passengerLabel = [
    adults > 0 ? `${adults} adulto${adults > 1 ? 's' : ''}` : null,
    children > 0 ? `${children} criança${children > 1 ? 's' : ''}` : null,
    infants > 0 ? `${infants} bebê${infants > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const resolveCityName = (code: string) => {
    const found = findAirport(code);
    return found ? found.city : code;
  };

  const originValid = Boolean(findAirport(origin));
  const destinationValid = Boolean(findAirport(destination));

  const handleToggleSite = (id: string) => {
    if (selectedSites.includes(id)) {
      if (selectedSites.length > 1) {
        setSelectedSites(selectedSites.filter((s) => s !== id));
      }
    } else {
      setSelectedSites([...selectedSites, id]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: Record<string, unknown> = {
      origin: origin.toUpperCase().trim(),
      originCity: resolveCityName(origin),
      destination: destination.toUpperCase().trim(),
      destinationCity: resolveCityName(destination),
      searchMode,
      adults,
      children,
      infants,
      targetPrice: Number(targetPrice),
      targetPriceMarginPercent,
      trackedSites: selectedSites,
      email: email || currentUserEmail,
    };

    if (searchMode === 'dated') {
      payload.departureDate = departureDate;
      payload.departDaysBefore = departDaysBefore;
      payload.departDaysAfter = departDaysAfter;
      payload.returnDate = returnDate;
      payload.returnDaysBefore = returnDaysBefore;
      payload.returnDaysAfter = returnDaysAfter;
    }

    await onSubmit(payload);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-paper-card shadow-card" id="monitor-config-form">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-serif text-lg font-semibold">Novo monitoramento</h2>
        <p className="text-xs text-ink-muted">Preencha como se fosse tirar a passagem</p>
      </div>

      <div className="space-y-3.5 p-5">
        <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border bg-paper-deep p-1">
          <button
            type="button"
            onClick={() => setSearchMode('dated')}
            className={`flex items-center justify-center gap-1.5 rounded py-2 text-xs font-bold transition ${
              searchMode === 'dated' ? 'bg-paper-card text-terracotta shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Tenho datas
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('anytime')}
            className={`flex items-center justify-center gap-1.5 rounded py-2 text-xs font-bold transition ${
              searchMode === 'anytime' ? 'bg-paper-card text-terracotta shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <CalendarX className="h-3.5 w-3.5" />
            Só me importa o preço
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <AirportAutocomplete
            id="mf-origin"
            label="Origem"
            placeholder="Busque por cidade ou código"
            value={origin}
            onChange={setOrigin}
          />
          <div className="hidden pb-2.5 text-ink-muted sm:block">→</div>
          <AirportAutocomplete
            id="mf-destination"
            label="Destino"
            placeholder="Busque por cidade ou código"
            value={destination}
            onChange={setDestination}
          />
        </div>

        {searchMode === 'dated' ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="mf-departure" className={labelClass}>Quando você pode ir?</label>
              <input
                id="mf-departure"
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className={`${plainInputClass} mb-2`}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="mf-dep-before" className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-ink-muted">Dias antes</label>
                  <select id="mf-dep-before" value={departDaysBefore} onChange={(e) => setDepartDaysBefore(Number(e.target.value))} className={selectClass}>
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="mf-dep-after" className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-ink-muted">Dias depois</label>
                  <select id="mf-dep-after" value={departDaysAfter} onChange={(e) => setDepartDaysAfter(Number(e.target.value))} className={selectClass}>
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="mf-return" className={labelClass}>Quando você volta?</label>
              <input
                id="mf-return"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className={`${plainInputClass} mb-2`}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="mf-ret-before" className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-ink-muted">Dias antes</label>
                  <select id="mf-ret-before" value={returnDaysBefore} onChange={(e) => setReturnDaysBefore(Number(e.target.value))} className={selectClass}>
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="mf-ret-after" className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-ink-muted">Dias depois</label>
                  <select id="mf-ret-after" value={returnDaysAfter} onChange={(e) => setReturnDaysAfter(Number(e.target.value))} className={selectClass}>
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-border bg-paper-deep p-3 text-xs text-ink-muted">
            <CalendarX className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" aria-hidden="true" />
            <p>Sem data marcada. Avisamos assim que <strong className="text-ink">qualquer</strong> data futura para essa rota bater a sua meta de preço.</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-paper-deep p-3">
          <div>
            <label htmlFor="mf-adults" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink-muted">Adultos</label>
            <select id="mf-adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={`${selectClass} bg-paper-card`}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <p className="mt-0.5 text-[9px] text-ink-muted">12 anos ou mais</p>
          </div>
          <div>
            <label htmlFor="mf-children" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink-muted">Crianças</label>
            <select id="mf-children" value={children} onChange={(e) => setChildren(Number(e.target.value))} className={`${selectClass} bg-paper-card`}>
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <p className="mt-0.5 text-[9px] text-ink-muted">2 a 11 anos</p>
          </div>
          <div>
            <label htmlFor="mf-infants" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-ink-muted">Bebês</label>
            <select id="mf-infants" value={infants} onChange={(e) => setInfants(Number(e.target.value))} className={`${selectClass} bg-paper-card`}>
              {[0, 1, 2, 3, 4].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <p className="mt-0.5 text-[9px] text-ink-muted">Até 2 anos, no colo</p>
          </div>
        </div>

        {(routeStats || statsLoading) && (
          <div className="rounded-md border border-border bg-paper-deep p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                <TrendingUp className="h-3 w-3 text-terracotta" />
                Histórico de preço para esta rota
              </span>
              {routeStats && <span className="text-[9px] text-ink-muted">últimos {routeStats.sampleWindowDays} dias</span>}
            </div>
            {statsLoading && !routeStats ? (
              <p className="text-xs font-medium text-ink-muted">Consultando o histórico...</p>
            ) : routeStats ? (
              <>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="font-mono text-lg font-extrabold">R$ {routeStats.average.toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] font-medium text-ink-muted">
                    média total para {passengerLabel} · faixa R$ {routeStats.min.toLocaleString('pt-BR')} – R$ {routeStats.max.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-ink-muted">
                    Metas abaixo de <strong className="text-ink">R$ {routeStats.min.toLocaleString('pt-BR')}</strong> podem demorar mais para disparar.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTargetPrice(String(routeStats.min))}
                    className="whitespace-nowrap rounded border border-terracotta/30 bg-terracotta-wash px-2 py-1 text-[10px] font-bold text-terracotta transition hover:brightness-95"
                  >
                    Usar R$ {routeStats.min.toLocaleString('pt-BR')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        <div>
          <label htmlFor="mf-target-price" className={labelClass}>Valor Alvo Máximo (BRL)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-ink-muted">R$</span>
            <input
              id="mf-target-price"
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Ex: 3500"
              className={`${inputClass} pl-9`}
              required
            />
          </div>
          <p className="mt-1 text-[10px] text-ink-muted">Enviaremos alerta imediatamente ao alcançar este valor ou menos.</p>
        </div>

        <MarginPresetControl
          targetPrice={Number(targetPrice) || 0}
          value={targetPriceMarginPercent}
          onChange={setTargetPriceMarginPercent}
        />

        <div>
          <label htmlFor="mf-email" className={labelClass}>E-mail para Notificações</label>
          <input
            id="mf-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={plainInputClass}
            required
          />
        </div>

        <fieldset>
          <legend className={labelClass}>Pesquisar nos seguintes sites</legend>
          <div className="grid grid-cols-2 gap-2">
            {airlineSites.map((site) => (
              <label
                key={site.id}
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition-all ${
                  selectedSites.includes(site.id)
                    ? 'border-terracotta bg-terracotta-wash font-bold text-ink'
                    : 'border-border-strong bg-paper text-ink-muted hover:bg-paper-deep'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSites.includes(site.id)}
                  onChange={() => handleToggleSite(site.id)}
                  className="h-4 w-4 rounded border-border-strong text-terracotta focus:ring-terracotta"
                />
                <span className="truncate font-medium">{site.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={isSubmitting || !originValid || !destinationValid}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-terracotta-solid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:cursor-not-allowed disabled:bg-paper-deep disabled:text-ink-muted"
        >
          <Plus className="h-4 w-4 stroke-[2.5px]" />
          {isSubmitting ? 'Cadastrando...' : 'Adicionar Alerta de Passagens'}
        </button>
        {(!originValid || !destinationValid) && (
          <p className="mt-1 text-center text-[10px] text-ink-muted">Selecione origem e destino de uma cidade com aeroporto na lista.</p>
        )}
      </div>
    </form>
  );
}
