'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { apiFetch } from './api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Erro capturado ao voltar do redirect do Google (signInWithRedirect não rejeita uma promise local — o resultado só existe depois que a página recarrega). */
  redirectError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        // Garante que o documento de perfil exista no Firestore (idempotente).
        apiFetch('/api/me').catch((err) => console.error('Falha ao sincronizar perfil:', err));
      }
    });
  }, []);

  useEffect(() => {
    // Login com Google usa signInWithRedirect (não popup) — mais robusto
    // em produção, sem depender de popup/iframe entre três domínios
    // diferentes. O resultado só chega aqui, na volta do redirect.
    getRedirectResult(auth).catch((err) => {
      setRedirectError((err as { code?: string })?.code ?? 'auth/internal-error');
    });
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    redirectError,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUp: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    signInWithGoogle: async () => {
      await signInWithRedirect(auth, new GoogleAuthProvider());
    },
    signOut: async () => {
      await firebaseSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }
  return ctx;
}
