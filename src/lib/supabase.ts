import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Storage customizado ───────────────────────────────────────────────────────
// O Supabase precisa persistir a sessão (token JWT) entre aberturas do app.
// No browser usaria localStorage, mas no React Native usamos AsyncStorage.
// O problema: durante o bundle estático do Expo Router (SSR/Node.js),
// AsyncStorage tenta acessar `window` — que não existe em Node.
// Solução: checar a plataforma antes de acessar qualquer API de storage.

const ExpoSecureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      // No web, usa localStorage normalmente (roda no browser, window existe)
      return typeof window !== 'undefined'
        ? window.localStorage.getItem(key)
        : null;
    }
    // iOS / Android → AsyncStorage
    return AsyncStorage.getItem(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

// ─── Cliente Supabase ──────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStorage,
    autoRefreshToken: true,      // renova o JWT automaticamente
    persistSession: true,        // mantém login entre fechamentos do app
    detectSessionInUrl: false,   // desativa detecção de OAuth via URL (não usamos)
  },
});