'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { apiFetch } from './api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  /** Recebe o ID token do Google Identity Services (não signInWithPopup/signInWithRedirect do Firebase — ver _local-edr-policy-008 amendment) e completa o login no Firebase. */
  signInWithGoogleCredential: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const value: AuthContextValue = {
    user,
    loading,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUp: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    signInWithGoogleCredential: async (idToken) => {
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
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
