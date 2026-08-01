'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import WaitlistLanding from '../components/WaitlistLanding';

/**
 * Landing de espera na raiz — ver _local-adr-policy-004 (platform).
 * Visitante não-autenticado vê a landing pública (pré-lançamento), não
 * mais um redirect automático pra /login. Quem já tem conta continua
 * indo direto pro /dashboard; /login continua acessível diretamente pra
 * quem for testar/usar o produto real.
 */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || user) return null;

  return <WaitlistLanding />;
}
