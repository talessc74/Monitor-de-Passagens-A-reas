'use client';

import { useState } from 'react';
import { Mail, CheckCircle2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

/**
 * Landing de espera (pré-lançamento) — ver _local-adr-policy-004 (platform).
 * Regras inegociáveis do Conselho (não flexibilizar sem nova deliberação):
 * 1. Nunca menciona fornecedor de dados técnico.
 * 2. Nunca declara prazo/data de lançamento, nem implícito.
 * 3. Nunca promete precisão técnica — a promessa é sobre o alerta, não a tecnologia.
 */
export default function WaitlistLanding() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — mantido vazio por humanos
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
      if (!res.ok) throw new Error('Falha ao cadastrar');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink antialiased">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="flex items-center justify-between pt-6">
          <div className="flex items-baseline gap-0.5 font-serif text-xl font-semibold tracking-tight">
            Fly<em className="not-italic text-terracotta">Spot</em>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 items-center gap-12 py-14 md:grid-cols-[1.15fr_0.85fr] md:gap-16 md:py-20">
          <div className="order-2 md:order-1">
            <p className="mb-4 flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em] text-terracotta uppercase">
              <span className="h-px w-4 bg-terracotta" aria-hidden="true" />
              Alerta de preço, não busca de passagem
            </p>
            <h1 className="mb-5 max-w-[15ch] font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Aquela viagem que importa, <em className="text-terracotta">pelo preço certo</em>.
            </h1>
            <p className="mb-8 max-w-[46ch] text-base leading-relaxed text-ink-muted sm:text-lg">
              Lua de mel, formatura, a volta pra casa pra ver a família. Diga qual é a sua meta de
              preço e a gente avisa assim que ela for atingida. Sem recarregar site de passagem
              todo dia.
            </p>

            {status === 'done' ? (
              <div className="max-w-[420px] rounded-xl border border-border bg-paper-card p-5 shadow-card">
                <CheckCircle2 className="mb-2 h-6 w-6 text-teal" aria-hidden="true" />
                <p className="text-sm text-ink">
                  Cadastro recebido. Ainda não temos uma data de lançamento definida, vamos te
                  avisar assim que o FlySpot estiver pronto pra sua rota.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="max-w-[420px]">
                <div className="flex flex-wrap gap-2.5">
                  <div className="relative min-w-[200px] flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                    <label htmlFor="waitlist-email" className="sr-only">Seu e-mail</label>
                    <input
                      id="waitlist-email"
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-md border border-border-strong bg-paper-card py-3.5 pl-10 pr-4 text-sm text-ink placeholder-ink-muted/70 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
                    />
                    {/* Honeypot anti-spam: invisível pra humano, tentador pra bot */}
                    <input
                      type="text"
                      name="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                      className="absolute -left-[9999px] h-0 w-0 opacity-0"
                      aria-hidden="true"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="whitespace-nowrap rounded-md border border-terracotta-solid bg-terracotta-solid px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-60"
                  >
                    {status === 'submitting' ? 'Enviando...' : 'Quero ser avisado'}
                  </button>
                </div>

                {status === 'error' && (
                  <p role="alert" className="mt-2 text-xs text-red-600">Algo deu errado. Tenta de novo em instantes.</p>
                )}

                <p className="mt-3 text-xs text-ink-muted/80">
                  Ainda não temos data de lançamento definida. Usamos seu e-mail só pra isso.
                </p>
              </form>
            )}
          </div>

          <div className="order-1 flex justify-center md:order-2">
            <TicketPreview />
          </div>
        </div>

        <div className="border-t border-border py-2 pb-24">
          <div className="flex flex-col gap-4 pt-14 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-[12ch] font-serif text-3xl font-semibold leading-tight">Como funciona</h2>
            <p className="max-w-[32ch] text-sm text-ink-muted md:text-right">
              Três passos. Sem planilha, sem aba aberta o dia inteiro esperando o preço mudar.
            </p>
          </div>

          <div className="mt-10 border-t border-border">
            <IndexRow n="01" title="Conte a rota">
              Origem, destino e as datas que servem pra você. Ou nem isso: dá pra dizer &quot;qualquer
              data&quot; e deixar só o preço decidir.
            </IndexRow>
            <IndexRow n="02" title="Defina o teto">
              O valor que faria você comprar na hora. A gente consulta as passagens com
              regularidade e compara com essa meta.
            </IndexRow>
            <IndexRow n="03" title="A gente avisa">
              Assim que o preço bater a meta, um e-mail chega com o valor encontrado e o link
              direto pra reservar.
            </IndexRow>
          </div>
        </div>
      </div>

      <footer className="bg-ink-strong py-10 text-paper-on-ink">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6">
          <div className="font-serif text-xl font-semibold">
            Fly<em className="not-italic text-terracotta-tint">Spot</em>
          </div>
          <p className="text-xs text-paper-on-ink-muted">
            © 2026 FlySpot. Sem data de lançamento definida.
          </p>
        </div>
      </footer>
    </div>
  );
}

function IndexRow({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[40px_1fr] gap-4 border-b border-border py-7 sm:grid-cols-[64px_1fr_1.3fr] sm:items-baseline sm:gap-7">
      <span className="font-mono text-[13px] text-terracotta">{n}</span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="col-span-2 max-w-[52ch] text-sm leading-relaxed text-ink-muted sm:col-span-1">{children}</p>
    </div>
  );
}

function TicketPreview() {
  return (
    <div className="relative w-full max-w-[340px]" role="img" aria-label="Exemplo de alerta: Guarulhos para Lisboa, meta de preço R$ 3.400, aguardando">
      <div className="absolute -right-4 -bottom-4 left-4 top-4 -z-10 [transform:rotate(-4deg)] rounded-2xl border border-border bg-paper-deep" aria-hidden="true" />
      <div className="relative [transform:rotate(3deg)] rounded-2xl border border-border bg-paper-card shadow-card motion-safe:animate-[float_6s_ease-in-out_infinite]">
        <div className="flex items-start justify-between px-5 pb-4 pt-5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">FlySpot · Alerta</span>
          <span className="[transform:rotate(-4deg)] rounded-full border border-teal px-2 font-mono text-[10px] uppercase tracking-wider text-teal">
            Aguardando
          </span>
        </div>
        <div className="flex items-center justify-between px-5 pb-5">
          <div>
            <div className="font-mono text-[34px] font-bold leading-none tracking-tight">GRU</div>
            <div className="mt-0.5 text-[11px] text-ink-muted">São Paulo</div>
          </div>
          <div className="relative top-[-6px] mx-3 h-px flex-1 bg-[repeating-linear-gradient(to_right,var(--color-border-strong)_0_6px,transparent_6px_11px)]" />
          <div className="text-right">
            <div className="font-mono text-[34px] font-bold leading-none tracking-tight">LIS</div>
            <div className="mt-0.5 text-[11px] text-ink-muted">Lisboa</div>
          </div>
        </div>
        <div className="relative mx-5 border-t-2 border-dashed border-border-strong">
          <span className="absolute -left-[29px] -top-[9px] h-[18px] w-[18px] rounded-full bg-paper" aria-hidden="true" />
          <span className="absolute -right-[29px] -top-[9px] h-[18px] w-[18px] rounded-full bg-paper" aria-hidden="true" />
        </div>
        <div className="flex items-end justify-between px-5 pb-6 pt-4">
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-ink-muted">Menor lido</div>
            <div className="font-mono text-xl font-bold text-terracotta">R$ 3.890</div>
          </div>
          <div className="text-right">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-ink-muted">Meta</div>
            <div className="font-mono text-sm font-bold text-ink-muted">R$ 3.400</div>
          </div>
        </div>
      </div>
    </div>
  );
}
