'use client';

import { useEffect, useRef, useState } from 'react';
import { findAirport, searchAirports, type Airport } from '@mpa/types';

interface AirportAutocompleteProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (code: string) => void;
}

/**
 * Só aceita seleção de um item da lista fechada de aeroportos — digitar
 * um código inexistente ou o nome de uma cidade sem aeroporto simplesmente
 * não produz nenhuma sugestão pra clicar, então `value` nunca vira algo
 * fora da lista. Ver deliberação Compass/Empiricus/PolarBear.
 */
export default function AirportAutocomplete({ id, label, placeholder, value, onChange }: AirportAutocompleteProps) {
  const selected = findAirport(value);
  const [query, setQuery] = useState(selected ? `${selected.city} (${selected.code})` : value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = findAirport(value);
    setQuery(current ? `${current.city} (${current.code})` : value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = searchAirports(query === `${selected?.city} (${selected?.code})` ? '' : query);

  const handleSelect = (airport: Airport) => {
    onChange(airport.code);
    setQuery(`${airport.city} (${airport.code})`);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          if (!findAirport(e.target.value)) {
            onChange('');
          }
        }}
        onFocus={() => setIsOpen(true)}
        autoComplete="off"
        className="w-full rounded-md border border-border-strong bg-paper px-3 py-2 text-sm font-bold text-ink font-mono focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        required
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border-strong bg-paper-card shadow-lg">
          {results.map((airport) => (
            <li key={airport.code}>
              <button
                type="button"
                onClick={() => handleSelect(airport)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-paper-deep"
              >
                <span>
                  <span className="font-semibold text-ink">{airport.city}</span>
                  <span className="ml-1 text-ink-muted">{airport.name}</span>
                </span>
                <span className="font-mono font-bold text-terracotta">{airport.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {isOpen && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border-strong bg-paper-card p-3 text-[11px] text-ink-muted shadow-lg">
          Nenhum aeroporto encontrado. Verifique o nome da cidade ou o código.
        </div>
      )}
    </div>
  );
}
