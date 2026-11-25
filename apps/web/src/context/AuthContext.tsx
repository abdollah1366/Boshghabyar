import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Plan, UserGoal } from '@boshghabyar/core';

import { api, getToken, setToken } from '../lib/api';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'user' | 'admin';
  plan: Plan;
  goal: UserGoal;
  createdAt: string;
}

interface AuthValue {
  user: AppUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  updateGoal: (goal: Partial<UserGoal>) => Promise<void>;
  upgrade: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<{ user: AppUser }>('/api/me')
      .then(({ user: me }) => setUser(me))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ token: string; user: AppUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await api<{ token: string; user: AppUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const updateGoal = useCallback(async (goal: Partial<UserGoal>) => {
    const result = await api<{ user: AppUser }>('/api/me/goal', {
      method: 'PATCH',
      body: JSON.stringify(goal),
    });
    setUser(result.user);
  }, []);

  const upgrade = useCallback(async () => {
    const result = await api<{ user: AppUser }>('/api/upgrade', {
      method: 'POST',
      body: JSON.stringify({ plan: 'pro' }),
    });
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, updateGoal, upgrade, logout }),
    [user, ready, login, register, updateGoal, upgrade, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider missing');
  return ctx;
}
