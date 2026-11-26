import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserGoal } from '@boshghabyar/core';

import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api';
import { clearFoodsCache } from '../lib/hooks';
import type { AppUser } from '../lib/types';

interface AuthValue {
  user: AppUser | null;
  ready: boolean;
  /** نشست پایان یافته (۴۰۱) و کاربر باید دوباره وارد شود */
  expired: boolean;
  signIn: (token: string, user: AppUser) => void;
  refresh: () => Promise<void>;
  setUser: (user: AppUser) => void;
  updateGoal: (goal: Partial<UserGoal>) => Promise<void>;
  updateProfile: (input: { name?: string; researchConsent?: boolean }) => Promise<AppUser>;
  upgrade: () => Promise<void>;
  logout: (everywhere?: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUserState(null);
      setExpired(true);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<{ user: AppUser }>('/api/me')
      .then(({ user: me }) => setUserState(me))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback((token: string, next: AppUser) => {
    setToken(token);
    clearFoodsCache();
    setUserState(next);
    setExpired(false);
  }, []);

  const refresh = useCallback(async () => {
    const { user: me } = await api<{ user: AppUser }>('/api/me');
    setUserState(me);
  }, []);

  const updateGoal = useCallback(async (goal: Partial<UserGoal>) => {
    const result = await api<{ user: AppUser }>('/api/me/goal', { method: 'PATCH', json: goal });
    setUserState(result.user);
  }, []);

  const updateProfile = useCallback(async (input: { name?: string; researchConsent?: boolean }) => {
    const result = await api<{ user: AppUser }>('/api/me', { method: 'PATCH', json: input });
    setUserState(result.user);
    return result.user;
  }, []);

  const upgrade = useCallback(async () => {
    const result = await api<{ user: AppUser }>('/api/upgrade', { method: 'POST', json: { plan: 'pro' } });
    clearFoodsCache();
    setUserState(result.user);
  }, []);

  const logout = useCallback(async (everywhere = false) => {
    try {
      await api(everywhere ? '/api/auth/logout-all' : '/api/auth/logout', { method: 'POST', timeoutMs: 6000 });
    } catch {
      /* حتی اگر سرور پاسخ ندهد، نشست محلی پاک می‌شود */
    }
    setToken(null);
    clearFoodsCache();
    setUserState(null);
    setExpired(false);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api('/api/me', { method: 'DELETE', json: { confirm: true } });
    setToken(null);
    clearFoodsCache();
    setUserState(null);
    setExpired(false);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, ready, expired, signIn, refresh, setUser: setUserState, updateGoal, updateProfile, upgrade, logout, deleteAccount }),
    [user, ready, expired, signIn, refresh, updateGoal, updateProfile, upgrade, logout, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}
