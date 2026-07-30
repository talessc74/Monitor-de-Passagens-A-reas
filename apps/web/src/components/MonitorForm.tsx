'use client';

import { useEffect, useState } from 'react';
import { PlaneTakeoff, PlaneLanding, Users, Calendar, DollarSign, ListFilter, Mail, Plus, TrendingUp, CalendarX } from 'lucide-react';
import type { AirlineSite, RouteStats } from '@mpa/types';
import { apiFetch } from '../lib/api';
import MarginPresetControl from './MarginPresetControl';

interface MonitorFormProps {
  airlineSites: AirlineSite[];
  onSubmit: (data: any) => Promise<boolean>;
  currentUserEmail: string;
}

const POPULAR_AIRPORTS = [
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos' },
  { code: 'GIG', city: 'Rio de Janeiro', name: 'Galeão' },
  { code: 'BSB', city: 'Brasília', name: 'Juscelino Kubitschek' },
  { code: 'LIS', city: 'Lisboa', name: 'Humberto Delgado' },
  { code: 'MIA', city: 'Miami', name: 'Miami International' },
  { code: 'EZE', city: 'Buenos Aires', name: 'Ezeiza' },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle' },
];

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 7, 10, 15];

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

  const resolveCityName = (code: string) => {
    const found = POPULAR_AIRPORTS.find((a) => a.code.toUpperCase() === code.toUpperCase());
    return found ? found.city : code;
  };

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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100/30" id="monitor-config-form">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Novo Monitoramento</h2>
          <p className="text-xs text-slate-400 font-medium">Configure suas metas e datas de viagem</p>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-500 border border-slate-100">
          <ListFilter className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setSearchMode('dated')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
              searchMode === 'dated' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Tenho datas
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('anytime')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
              searchMode === 'anytime' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarX className="h-3.5 w-3.5" />
            Só me importa o preço
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <PlaneTakeoff className="h-3.5 w-3.5 text-slate-400" />
              Origem (Partida)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: GRU ou São Paulo"
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold transition-all"
                required
              />
              <div className="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                {resolveCityName(origin)}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-400">
              <span className="text-slate-500 font-bold">Atalhos:</span>
              <button type="button" onClick={() => setOrigin('GRU')} className="hover:text-blue-600 transition font-medium">GRU</button>
              <button type="button" onClick={() => setOrigin('GIG')} className="hover:text-blue-600 transition font-medium">GIG</button>
              <button type="button" onClick={() => setOrigin('BSB')} className="hover:text-blue-600 transition font-medium">BSB</button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <PlaneLanding className="h-3.5 w-3.5 text-slate-400" />
              Destino (Retorno)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: LIS ou Lisboa"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold underline decoration-blue-500 decoration-2 transition-all"
                required
              />
              <div className="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                {resolveCityName(destination)}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-400">
              <span className="text-slate-500 font-bold">Atalhos:</span>
              <button type="button" onClick={() => setDestination('LIS')} className="hover:text-blue-600 transition font-medium">LIS</button>
              <button type="button" onClick={() => setDestination('MIA')} className="hover:text-blue-600 transition font-medium">MIA</button>
              <button type="button" onClick={() => setDestination('EZE')} className="hover:text-blue-600 transition font-medium">EZE</button>
            </div>
          </div>
        </div>

        {searchMode === 'dated' ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Quando você pode ir?
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold transition"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">Dias antes</label>
                  <select
                    value={departDaysBefore}
                    onChange={(e) => setDepartDaysBefore(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">Dias depois</label>
                  <select
                    value={departDaysAfter}
                    onChange={(e) => setDepartDaysAfter(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Quando você volta?
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold transition"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">Dias antes</label>
                  <select
                    value={returnDaysBefore}
                    onChange={(e) => setReturnDaysBefore(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">Dias depois</label>
                  <select
                    value={returnDaysAfter}
                    onChange={(e) => setReturnDaysAfter(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900">
            <CalendarX className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
            <p>Sem data marcada. Avisamos assim que <strong>qualquer</strong> data futura para essa rota bater a sua meta de preço.</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200/60">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-400" />
              Adultos
            </label>
            <select
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <p className="mt-0.5 text-[9px] text-slate-400">12 anos ou mais</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-400" />
              Crianças
            </label>
            <select
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <p className="mt-0.5 text-[9px] text-slate-400">2 a 11 anos</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-400" />
              Bebês
            </label>
            <select
              value={infants}
              onChange={(e) => setInfants(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {[0, 1, 2, 3, 4].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <p className="mt-0.5 text-[9px] text-slate-400">Até 2 anos, no colo</p>
          </div>
        </div>

        {(routeStats || statsLoading) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <TrendingUp className="h-3 w-3 text-blue-600" />
                Histórico de preço para esta rota
              </span>
              {routeStats && <span className="text-[9px] text-slate-400">últimos {routeStats.sampleWindowDays} dias</span>}
            </div>
            {statsLoading && !routeStats ? (
              <p className="text-xs text-slate-400 font-medium">Consultando o histórico...</p>
            ) : routeStats ? (
              <>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-lg font-extrabold text-slate-800">R$ {routeStats.average.toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    média · faixa R$ {routeStats.min.toLocaleString('pt-BR')} – R$ {routeStats.max.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-500">
                    Metas abaixo de <strong className="text-slate-700">R$ {routeStats.min.toLocaleString('pt-BR')}</strong> podem demorar mais para disparar.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTargetPrice(String(routeStats.min))}
                    className="whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition"
                  >
                    Usar R$ {routeStats.min.toLocaleString('pt-BR')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-blue-600" />
            Valor Alvo Máximo (BRL)
          </label>
          <div className="relative">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Ex: 3500"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-extrabold"
              required
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400 font-medium">
            Enviaremos alerta imediatamente ao alcançar este valor ou menos.
          </p>
        </div>

        <MarginPresetControl
          targetPrice={Number(targetPrice) || 0}
          value={targetPriceMarginPercent}
          onChange={setTargetPriceMarginPercent}
        />

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-slate-400" />
            E-mail para Notificações
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Pesquisar nos seguintes sites:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {airlineSites.map((site) => (
              <label
                key={site.id}
                className={`flex items-center gap-2 rounded-lg border p-2 text-xs transition-all cursor-pointer ${
                  selectedSites.includes(site.id)
                    ? 'border-blue-500 bg-blue-50/30 text-blue-950 font-bold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSites.includes(site.id)}
                  onChange={() => handleToggleSite(site.id)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="truncate font-medium">{site.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4 stroke-[2.5px]" />
          {isSubmitting ? 'Cadastrando...' : 'Adicionar Alerta de Passagens'}
        </button>
      </div>
    </form>
  );
}
