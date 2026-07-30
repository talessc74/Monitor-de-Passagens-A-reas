'use client';

import { useState } from 'react';
import { X, Calendar, CalendarX, Users, DollarSign, Mail } from 'lucide-react';
import type { AirlineSite, FlightMonitor } from '@mpa/types';
import { useEscapeToClose } from '../lib/useEscapeToClose';

interface EditMonitorModalProps {
  monitor: FlightMonitor;
  airlineSites: AirlineSite[];
  onClose: () => void;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
}

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 7, 10, 15];

/**
 * Editar um monitor existente — disponível independente do status
 * (ativo ou pausado). Ver _local-bdr-policy-004.
 */
export default function EditMonitorModal({ monitor, airlineSites, onClose, onSave }: EditMonitorModalProps) {
  useEscapeToClose(onClose);

  const [searchMode, setSearchMode] = useState<'dated' | 'anytime'>(monitor.searchMode ?? 'dated');
  const [origin, setOrigin] = useState(monitor.origin);
  const [destination, setDestination] = useState(monitor.destination);
  const [departureDate, setDepartureDate] = useState(monitor.departureDate ?? '');
  const [departDaysBefore, setDepartDaysBefore] = useState(monitor.departDaysBefore ?? 0);
  const [departDaysAfter, setDepartDaysAfter] = useState(monitor.departDaysAfter ?? 3);
  const [returnDate, setReturnDate] = useState(monitor.returnDate ?? '');
  const [returnDaysBefore, setReturnDaysBefore] = useState(monitor.returnDaysBefore ?? 0);
  const [returnDaysAfter, setReturnDaysAfter] = useState(monitor.returnDaysAfter ?? 3);
  const [adults, setAdults] = useState(monitor.adults);
  const [children, setChildren] = useState(monitor.children);
  const [infants, setInfants] = useState(monitor.infants ?? 0);
  const [targetPrice, setTargetPrice] = useState(String(monitor.targetPrice));
  const [email, setEmail] = useState(monitor.email);
  const [selectedSites, setSelectedSites] = useState<string[]>(monitor.trackedSites);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleToggleSite = (id: string) => {
    if (selectedSites.includes(id)) {
      if (selectedSites.length > 1) setSelectedSites(selectedSites.filter((s) => s !== id));
    } else {
      setSelectedSites([...selectedSites, id]);
    }
  };

  const handleSave = async () => {
    if (searchMode === 'dated' && (!departureDate || !returnDate)) {
      setError('Preencha as duas datas, ou mude para "Só me importa o preço".');
      return;
    }

    setIsSaving(true);
    setError('');

    const patch: Record<string, unknown> = {
      origin: origin.toUpperCase().trim(),
      destination: destination.toUpperCase().trim(),
      searchMode,
      adults,
      children,
      infants,
      targetPrice: Number(targetPrice),
      trackedSites: selectedSites,
      email,
    };

    if (searchMode === 'dated') {
      patch.departureDate = departureDate;
      patch.departDaysBefore = departDaysBefore;
      patch.departDaysAfter = departDaysAfter;
      patch.returnDate = returnDate;
      patch.returnDaysBefore = returnDaysBefore;
      patch.returnDaysAfter = returnDaysAfter;
    }

    const ok = await onSave(monitor.id, patch);
    setIsSaving(false);
    if (ok) {
      onClose();
    } else {
      setError('Não foi possível salvar as alterações. Tente novamente.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-monitor-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-monitor-title" className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Editar alerta {monitor.origin} → {monitor.destination}
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Origem</label>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Destino</label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {searchMode === 'dated' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Data de ida</label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
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
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Data de volta</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
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
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
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
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
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
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
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
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-blue-600" />
              Meta de preço (BRL)
            </label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm font-extrabold text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              E-mail para notificações
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Sites pesquisados</label>
            <div className="grid grid-cols-2 gap-2">
              {airlineSites.map((site) => (
                <label
                  key={site.id}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer transition-all ${
                    selectedSites.includes(site.id)
                      ? 'border-blue-500 bg-blue-50/30 text-blue-950 font-bold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSites.includes(site.id)}
                    onChange={() => handleToggleSite(site.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate font-medium">{site.name}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
