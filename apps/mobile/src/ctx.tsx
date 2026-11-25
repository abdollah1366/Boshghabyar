import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Plan, UserGoal } from '@boshghabyar/core';

import { api, setApiToken } from './lib/api';
import { useStorageState } from './useStorageState';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  plan: Plan;
  goal: UserGoal;
}

interface SessionValue {
  user: AppUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  upgrade: () => Promise<void>;
  updateGoal: (goal: Partial<UserGoal>) => Promise<void>;
  demoSignIn: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider missing');
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState('boshghabyar_session');
  const [user, setUser] = useState<AppUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setApiToken(session);
    if (!session) {
      setUser(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    api<{ user: AppUser }>('/api/me')
      .then((result) => { if (!cancelled) setUser(result.user); })
      .catch(() => { if (!cancelled) { setSession(null); setApiToken(null); } })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [session, setSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api<{ token: string; user: AppUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setApiToken(result.token);
    setSession(result.token);
    setUser(result.user);
  }, [setSession]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const result = await api<{ token: string; user: AppUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setApiToken(result.token);
    setSession(result.token);
    setUser(result.user);
  }, [setSession]);

  const demoSignIn = useCallback(async () => {
    await signIn('demo@boshghabyar.ir', 'Demo@12345');
  }, [signIn]);

  const signOut = useCallback(() => {
    setSession(null);
    setApiToken(null);
    setUser(null);
  }, [setSession]);

  const upgrade = useCallback(async () => {
    const result = await api<{ user: AppUser }>('/api/upgrade', {
      method: 'POST',
      body: JSON.stringify({ plan: 'pro' }),
    });
    setUser(result.user);
  }, []);

  const updateGoal = useCallback(async (goal: Partial<UserGoal>) => {
    const result = await api<{ user: AppUser }>('/api/me/goal', {
      method: 'PATCH',
      body: JSON.stringify(goal),
    });
    setUser(result.user);
  }, []);

  return (
    <SessionContext.Provider value={{
      user,
      isLoading: isLoading || checking,
      signIn,
      signUp,
      signOut,
      upgrade,
      updateGoal,
      demoSignIn,
    }}>
      {children}
    </SessionContext.Provider>
  );
}
