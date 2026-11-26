import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { api, setOnUnauthorized, setToken } from './api';

export type User = {
  id: number;
  username: string;
  nama_maklon: string | null;
  role: { nama_role: string };
};

type Auth = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const TOKEN_KEY = 'sergab_token';
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function bersihkanSesi() {
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }

  useEffect(() => {
    setOnUnauthorized(() => void bersihkanSesi());

    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (saved) {
        setToken(saved);
        try {
          setUser((await api<{ user: User }>('/me')).user);
        } catch {
          // Token kedaluwarsa/dicabut ditangani onUnauthorized; gagal jaringan: tetap di layar login.
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(username: string, password: string) {
    const res = await api<{ user: User; token: string }>('/login', {
      method: 'POST',
      body: { username, password, device_name: `sergab-${Platform.OS}` },
    });
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await api('/logout', { method: 'POST' }).catch(() => {});
    await bersihkanSesi();
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
