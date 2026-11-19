'use client';

/**
 * Keeps the logged-in user in React context.
 * On load we re-validate the stored token with GET /auth/me so a stale or
 * expired token never shows the wrong UI.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  /** Replace the user in memory after editing "Mon compte". */
  updateUser: (user: User) => void;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, signIn: () => {}, signOut: () => {}, updateUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = tokenStore.get()
      ? api.get<User>('/auth/me').then(setUser).catch(() => tokenStore.clear())
      : Promise.resolve();
    check.finally(() => setLoading(false));
  }, []);

  const signIn = useCallback((token: string, u: User) => {
    tokenStore.set(token);
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  return <Ctx.Provider value={{ user, loading, signIn, signOut, updateUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/** Where each role lands after login. */
export const homeFor = (u: User) => (u.role === 'ADMIN' ? '/admin' : u.role === 'PROVIDER' ? '/dashboard' : '/compte');
