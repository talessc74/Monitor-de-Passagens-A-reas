'use client';

import { Link2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { AirlineSite } from '@mpa/types';

interface SitesListProps {
  sites: AirlineSite[];
  onToggleSiteStatus: (id: string) => void;
}

export default function SitesList({ sites, onToggleSiteStatus }: SitesListProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/30" id="airline-sites-tracker">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Diretório de Sites Mapeados</h2>
        <p className="text-xs text-slate-400 font-medium leading-relaxed">
          Canais de busca integrados. Desative canais para fins de manutenção ou lentidão.
        </p>
      </div>

      <div className="space-y-3">
        {sites.map((site) => (
          <div key={site.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50/50 transition-all">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-black text-xs">
                {site.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{site.name}</span>
                  <a href={site.url} target="_blank" referrerPolicy="no-referrer" className="text-slate-400 hover:text-blue-600 transition" title="Visitar Site Oficial" rel="noreferrer">
                    <Link2 className="h-3 w-3" />
                  </a>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                  <span>Varreduras recomendadas: {site.scrapedCount}</span>
                  <span>•</span>
                  <span>Ping: {site.avgResponseMs}ms</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleSiteStatus(site.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition flex items-center gap-1 leading-none ${
                  site.status === 'active' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title="Clique para alternar status do canal"
              >
                {site.status === 'active' ? (
                  <>
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Ativo
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-2.5 w-2.5" />
                    Inativo
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
