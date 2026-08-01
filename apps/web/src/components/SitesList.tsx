'use client';

import { Link2 } from 'lucide-react';
import type { AirlineSite } from '@mpa/types';

interface SitesListProps {
  sites: AirlineSite[];
  onToggleSiteStatus: (id: string) => void;
}

export default function SitesList({ sites, onToggleSiteStatus }: SitesListProps) {
  return (
    <div className="rounded-xl border border-border bg-paper-card shadow-card" id="airline-sites-tracker">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-serif text-lg font-semibold">Sites monitorados</h2>
        <p className="text-xs text-ink-muted">Ligue ou desligue fontes de busca</p>
      </div>

      <div className="p-5">
        {sites.map((site, i) => (
          <div
            key={site.id}
            className={`flex items-center justify-between py-3 ${i < sites.length - 1 ? 'border-b border-border' : ''}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">{site.name}</span>
                <a
                  href={site.url}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  rel="noreferrer"
                  className="text-ink-muted transition hover:text-terracotta"
                  title="Visitar site oficial"
                >
                  <Link2 className="h-3 w-3" />
                </a>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-muted">
                {site.status === 'active' ? `${site.scrapedCount} varreduras · ${site.avgResponseMs}ms` : 'desligado'}
              </div>
            </div>

            <button
              onClick={() => onToggleSiteStatus(site.id)}
              className={`relative h-[26px] w-11 shrink-0 rounded-full transition ${site.status === 'active' ? 'bg-teal' : 'bg-border-strong'}`}
              role="switch"
              aria-checked={site.status === 'active'}
              aria-label={site.status === 'active' ? `Desligar ${site.name}` : `Ligar ${site.name}`}
            >
              <span
                className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-transform ${
                  site.status === 'active' ? 'translate-x-[21px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
