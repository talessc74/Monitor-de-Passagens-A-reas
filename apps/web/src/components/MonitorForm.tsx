'use client';

import { useState } from 'react';
import { PlaneTakeoff, PlaneLanding, Users, Calendar, DollarSign, ListFilter, Mail, Plus } from 'lucide-react';
import type { AirlineSite } from '@mpa/types';

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

export default function MonitorForm({ airlineSites, onSubmit, currentUserEmail }: MonitorFormProps) {
  const [origin, setOrigin] = useState('GRU');
  const [destination, setDestination] = useState('LIS');
  const [departureDate, setDepartureDate] = useState('2026-10-12');
  const [returnDate, setReturnDate] = useState('2026-10-26');
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<string>('4000');
  const [email, setEmail] = useState(currentUserEmail);
  const [selectedSites, setSelectedSites] = useState<string[]>(['latam', 'gol', 'azul', 'decolar']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAveragePrice = () => {
    const o = (origin || '').toUpperCase().trim();
    const d = (destination || '').toUpperCase().trim();
    if (!o || !d) return 0;

    let basePrice = 1200;

    const isDomestic = (airport: string) => ['GRU', 'GIG', 'BSB'].includes(airport);
    const isEurope = (airport: string) => ['LIS', 'CDG'].includes(airport);
    const isUSA = (airport: string) => ['MIA'].includes(airport);
    const isSouthAmerica = (airport: string) => ['EZE'].includes(airport);

    if (isEurope(d) || isEurope(o)) {
      basePrice = 4800;
    } else if (isUSA(d) || isUSA(o)) {
      basePrice = 3300;
    } else if (isSouthAmerica(d) || isSouthAmerica(o)) {
      basePrice = 1800;
    } else if (!isDomestic(o) || !isDomestic(d)) {
      basePrice = 3500;
    }

    const multiplier = adults + children * 0.7;
    return Math.round(basePrice * multiplier);
  };

  const avgMarketPrice = getAveragePrice();

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

    const payload = {
      origin: origin.toUpperCase().trim(),
      originCity: resolveCityName(origin),
      destination: destination.toUpperCase().trim(),
      destinationCity: resolveCityName(destination),
      departureDate,
      returnDate,
      adults,
      children,
      targetPrice: Number(targetPrice),
      trackedSites: selectedSites,
      email: email || currentUserEmail,
    };

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Ida Provável
            </label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold transition"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Volta Provável
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold transition"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3 border border-slate-200/60">
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
                <option key={num} value={num}>
                  {num} {num === 1 ? 'Adulto' : 'Adultos'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-400" />
              Crianças (0-12 anos)
            </label>
            <select
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'Criança' : 'Crianças'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-blue-600" />
              Valor Alvo Máximo (BRL)
            </label>
            {avgMarketPrice > 0 && (
              <button
                type="button"
                onClick={() => setTargetPrice(avgMarketPrice.toString())}
                className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100/80 hover:bg-blue-100 hover:text-blue-700 rounded px-2 py-0.5 transition flex items-center gap-1 cursor-pointer"
                title="Clique para preencher com a média de mercado"
              >
                Média: <span className="font-extrabold text-blue-700">R$ {avgMarketPrice.toLocaleString('pt-BR')}</span>
              </button>
            )}
          </div>
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
