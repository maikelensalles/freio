// hooks/AppContext.tsx
// ─── Contexto global do app ────────────────────────────────────────────────────
// Resolve 3 problemas de uma vez:
// 1. Auth compartilhado → login redireciona sem precisar recarregar
// 2. Renda mensal compartilhada entre Home (registros) e Calendar (agenda)
// 3. Single source of truth — um único onAuthStateChange para todo o app

import { Session, User } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react';
import { supabase } from '../src/lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type AppContextType = {
  // Auth
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<any>;
  signUpWithEmail: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;

  // Renda mensal compartilhada
  monthlyIncome: number;           // valor numérico usado nos cálculos
  setMonthlyIncome: (v: number) => void;
};

// ─── Criação do contexto ──────────────────────────────────────────────────────
const AppContext = createContext<AppContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [user, setUser]                 = useState<User | null>(null);
  const [loading, setLoading]           = useState(true);
  const [monthlyIncome, setMonthlyIncome] = useState(0);

  const router   = useRouter();
  const segments = useSegments(); // ex: ['(tabs)', 'index'] ou ['login']

  // ── Auth state ───────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Recupera sessão salva no AsyncStorage ao abrir o app
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 2. Listener único — dispara em login, logout, refresh de token
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ── Redirect automático baseado na sessão ────────────────────────────────────
  // Roda sempre que session ou a rota atual muda.
  // Aguarda loading terminar para não fazer redirect prematuro.
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(tabs)'; // está dentro das tabs?

    if (!session && inAuthGroup) {
      // Sem sessão tentando acessar área protegida → vai para login
      router.replace('/login');
    } else if (session && !inAuthGroup) {
      // Com sessão na tela de login → entra no app
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  // ── Auth actions ─────────────────────────────────────────────────────────────
  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  async function signUpWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    return error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    // O useEffect acima detecta session=null e faz router.replace('/login')
  }

  return (
    <AppContext.Provider value={{
      session, user, loading,
      signInWithEmail, signUpWithEmail, signOut,
      monthlyIncome, setMonthlyIncome,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook de consumo ──────────────────────────────────────────────────────────
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>');
  return ctx;
}

// Mantém useAuth como alias para não quebrar imports existentes
export const useAuth = useApp;