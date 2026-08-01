'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import ThemeToggle from '../../components/ThemeToggle';

export default function LoginPage() {
  const { user, loading, signIn, signUp, signInWithGoogleCredential } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      setError(traduzErro(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleCredential(idToken: string) {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogleCredential(idToken);
    } catch (err) {
      setError(traduzErro(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[minmax(280px,38%)_1fr]">
      <div className="relative flex flex-col justify-between bg-ink-strong px-7 py-9 text-paper-on-ink sm:px-11 sm:py-12 md:min-h-0">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-0 border-r-2 border-dashed border-white/25 md:block"
          aria-hidden="true"
        >
          <span className="absolute -right-[13px] -top-[13px] h-[26px] w-[26px] rounded-full bg-paper" />
          <span className="absolute -right-[13px] -bottom-[13px] h-[26px] w-[26px] rounded-full bg-paper" />
        </div>

        <div className="font-serif text-xl font-semibold">
          Fly<em className="not-italic text-terracotta-tint">Spot</em>
        </div>

        <div className="my-7 md:my-0">
          <h1 className="mb-5 max-w-[12ch] font-serif text-2xl font-semibold leading-snug sm:text-[32px]">
            Sua meta de preço, vigiada com paciência.
          </h1>
          <p className="max-w-[34ch] text-sm leading-relaxed text-paper-on-ink-muted">
            A gente consulta as passagens com regularidade e só te procura quando o preço
            realmente bater a sua meta.
          </p>

          <ul className="mt-7 flex flex-col gap-4">
            <ChecklistItem>Alerta por e-mail assim que o valor cai</ChecklistItem>
            <ChecklistItem>Sem cartão. Sem compromisso pra começar</ChecklistItem>
            <ChecklistItem>Pausa e retoma o monitor quando quiser</ChecklistItem>
          </ul>
        </div>

        <div className="font-mono text-[11px] uppercase tracking-wider text-paper-on-ink-muted">
          GRU · GIG · BSB · LIS · MIA · EZE
        </div>
      </div>

      <div className="flex items-center justify-center bg-paper px-6 py-12 sm:px-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-terracotta">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Primeira vez por aqui'}
            </p>
            <ThemeToggle />
          </div>
          <h2 className="mb-1.5 font-serif text-2xl font-semibold text-ink">
            {mode === 'login' ? 'Entrar na sua conta' : 'Criar sua conta'}
          </h2>
          <p className="mb-7 text-sm text-ink-muted">
            {mode === 'login' ? 'Acesse seus alertas de preço.' : 'Comece a monitorar suas passagens.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-ink">E-mail</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border-strong bg-paper-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta"
                placeholder="voce@exemplo.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-ink">Senha</label>
              <input
                id="login-password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border-strong bg-paper-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta"
                placeholder="••••••••"
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-terracotta-solid py-3 text-sm font-semibold text-white transition hover:bg-terracotta-hover disabled:opacity-60"
            >
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-ink-muted">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <GoogleSignInButton onCredential={handleGoogleCredential} />

          <p className="mt-6 text-center text-sm text-ink-muted">
            {mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-terracotta underline underline-offset-2 hover:no-underline"
            >
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[13px] text-paper-on-ink">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-tint" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function traduzErro(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/unauthorized-domain': 'Este domínio não está autorizado para login. Fale com o suporte.',
    'auth/account-exists-with-different-credential': 'Este e-mail já está cadastrado com outro método de login.',
  };
  return map[code] ?? 'Não foi possível autenticar. Tente novamente.';
}
