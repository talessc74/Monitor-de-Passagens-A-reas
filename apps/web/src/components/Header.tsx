'use client';

import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-border bg-paper" id="app-header">
      <div className="mx-auto max-w-[1240px] px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div className="font-serif text-[19px] font-semibold">
            Fly<em className="not-italic text-terracotta">Spot</em>
          </div>

          <div className="flex items-center gap-6 text-[13px] text-ink-muted">
            <a href="/plans" className="no-underline hover:text-terracotta">Planos</a>
            <a href="/profile" className="no-underline hover:text-terracotta" title={user?.email ?? ''}>Perfil</a>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-ink-muted hover:text-terracotta"
              title="Sair"
              aria-label="Sair da conta"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
