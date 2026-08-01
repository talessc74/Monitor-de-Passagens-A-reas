'use client';

import { BellRing } from 'lucide-react';

const MARGIN_PRESETS = [0, 5, 10, 15, 20] as const;

interface MarginPresetControlProps {
  targetPrice: number;
  value: number;
  onChange: (value: number) => void;
}

/**
 * Faixa de aviso acima do preço-alvo — presets discretos em vez de
 * slider livre, sempre com o valor absoluto em R$ ao lado do
 * percentual. Mesmo componente usado no onboarding e no
 * EditMonitorModal. Ver _local-bdr-policy-005.
 */
export default function MarginPresetControl({ targetPrice, value, onChange }: MarginPresetControlProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
        <BellRing className="h-3.5 w-3.5 text-ink-muted" />
        Faixa de Aviso
      </legend>
      <div className="grid grid-cols-5 gap-1.5">
        {MARGIN_PRESETS.map((preset) => {
          const ceiling = targetPrice > 0 ? Math.round(targetPrice * (1 + preset / 100)) : null;
          const isSelected = value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={`flex flex-col items-center rounded-md border px-1 py-1.5 text-center transition-all ${
                isSelected
                  ? 'border-terracotta bg-terracotta-wash text-ink'
                  : 'border-border-strong bg-paper text-ink-muted hover:bg-paper-deep'
              }`}
            >
              <span className="text-xs font-extrabold">{preset === 0 ? 'só meta' : `+${preset}%`}</span>
              {preset > 0 && ceiling !== null && (
                <span className="text-[9px] font-medium text-ink-muted">até R$ {ceiling.toLocaleString('pt-BR')}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] font-medium text-ink-muted">
        {value === 0
          ? 'Avisamos só quando o preço atingir sua meta exata.'
          : `Também avisamos se o preço ficar até ${value}% acima da sua meta.`}
      </p>
    </fieldset>
  );
}
