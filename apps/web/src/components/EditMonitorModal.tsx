'use client';

import { useState } from 'react';
import { X, Calendar, CalendarX, Users, DollarSign, Mail } from 'lucide-react';
import type { AirlineSite, FlightMonitor } from '@mpa/types';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import MarginPresetControl from './MarginPresetControl';

interface EditMonitorModalProps {
  monitor: FlightMonitor;
  airlineSites: AirlineSite[];
  onClose: () => void;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
}

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 7, 10, 15];

const fieldInputClass =
  'w-full rounded-md border border-border-strong bg-paper px-3 py-2 text-sm font-bold text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta';
const selectClass =
  'w-full rounded-md border border-border-strong bg-paper px-2 py-1.5 text-xs font-bold text-ink focus:border-terracotta focus:outline-none';
const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-muted';

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
  const [targetPriceMarginPercent, setTargetPriceMarginPercent] = useState(monitor.targetPriceMarginPercent ?? 0);
  const [email, setEmail] = useState(monitor.email);
  const [selectedSites, setSelectedSites] = useState<string[]>(monitor.trackedSites);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const minReturnDate = (() => {
    if (!departureDate) return undefined;
    const nextDay = new Date(departureDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toISOString().slice(0, 10);
  })();

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
      targetPriceMarginPercent,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-paper-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-monitor-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-monitor-title" className="font-serif text-base font-semibold">
            Editar alerta {monitor.origin} → {monitor.destination}
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1 text-ink-muted transition hover:bg-paper-deep hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-paper-deep p-1">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-origin" className={labelClass}>Origem</label>
              <input id="edit-origin" value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} className={fieldInputClass} />
            </div>
            <div>
              <label htmlFor="edit-destination" className={labelClass}>Destino</label>
              <input id="edit-destination" value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} className={fieldInputClass} />
            </div>
          </div>

          {searchMode === 'dated' ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-departure" className={labelClass}>Data de ida</label>
                <input
                  id="edit-departure"
                  type="date"
                  value={departureDate}
                  onChange={(e) => {
                    const newDeparture = e.target.value;
                    setDepartureDate(newDeparture);
                    if (newDeparture && returnDate && returnDate <= newDeparture) {
                      const nextDay = new Date(newDeparture);
                      nextDay.setDate(nextDay.getDate() + 1);
                      setReturnDate(nextDay.toISOString().slice(0, 10));
                    }
                  }}
                  className={`${fieldInputClass} mb-2 font-semibold`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="edit-dep-before" className={labelClass}>Dias antes</label>
                    <select id="edit-dep-before" value={departDaysBefore} onChange={(e) => setDepartDaysBefore(Number(e.target.value))} className={selectClass}>
                      {DAY_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-dep-after" className={labelClass}>Dias depois</label>
                    <select id="edit-dep-after" value={departDaysAfter} onChange={(e) => setDepartDaysAfter(Number(e.target.value))} className={selectClass}>
                      {DAY_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="edit-return" className={labelClass}>Data de volta</label>
                <input
                  id="edit-return"
                  type="date"
                  value={returnDate}
                  min={minReturnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className={`${fieldInputClass} mb-2 font-semibold`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="edit-ret-before" className={labelClass}>Dias antes</label>
                    <select id="edit-ret-before" value={returnDaysBefore} onChange={(e) => setReturnDaysBefore(Number(e.target.value))} className={selectClass}>
                      {DAY_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d === 0 ? 'nenhum' : `${d} dia(s)`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-ret-after" className={labelClass}>Dias depois</label>
                    <select id="edit-ret-after" value={returnDaysAfter} onChange={(e) => setReturnDaysAfter(Number(e.target.value))} className={selectClass}>
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
              <CalendarX className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" />
              <p>Sem data marcada. Avisamos assim que <strong className="text-ink">qualquer</strong> data futura para essa rota bater a sua meta de preço.</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-paper-deep p-3">
            <div>
              <label htmlFor="edit-adults" className={`${labelClass} flex items-center gap-1`}>
                <Users className="h-3 w-3 text-ink-muted" />
                Adultos
              </label>
              <select id="edit-adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={`${selectClass} bg-paper-card`}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-children" className={`${labelClass} flex items-center gap-1`}>
                <Users className="h-3 w-3 text-ink-muted" />
                Crianças
              </label>
              <select id="edit-children" value={children} onChange={(e) => setChildren(Number(e.target.value))} className={`${selectClass} bg-paper-card`}>
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-infants" className={`${labelClass} flex items-center gap-1`}>
                <Users className="h-3 w-3 text-ink-muted" />
                Bebês
              </label>
              <select id="edit-infants" value={infants} onChange={(e) => setInfants(Number(e.target.value))} className={`${selectClass} bg-paper-card`}>
                {[0, 1, 2, 3, 4].map((num) => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="edit-target-price" className={`${labelClass} flex items-center gap-1.5 text-xs`}>
              <DollarSign className="h-3.5 w-3.5 text-terracotta" />
              Meta de preço (BRL)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-muted">R$</span>
              <input
                id="edit-target-price"
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className={`${fieldInputClass} pl-9`}
              />
            </div>
          </div>

          <MarginPresetControl
            targetPrice={Number(targetPrice) || 0}
            value={targetPriceMarginPercent}
            onChange={setTargetPriceMarginPercent}
          />

          <div>
            <label htmlFor="edit-email" className={`${labelClass} flex items-center gap-1.5 text-xs`}>
              <Mail className="h-3.5 w-3.5 text-ink-muted" />
              E-mail para notificações
            </label>
            <input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${fieldInputClass} font-medium`}
            />
          </div>

          <fieldset>
            <legend className={`${labelClass} text-xs`}>Sites pesquisados</legend>
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

          {error && <p className="text-xs font-semibold text-danger-text">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-border-strong px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-paper-deep"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 rounded-md bg-terracotta-solid px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:bg-paper-deep disabled:text-ink-muted"
            >
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
