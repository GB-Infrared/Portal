import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getToken, setToken, UNAUTHORIZED_EVENT } from '../api/client';
import { AUTH_MODE } from '../api/config';
import * as api from '../api/portal';
import type { User } from '../api/types';
import { ignoreErrors } from '../lib/ignoreErrors';

type Status = 'checking' | 'in' | 'out';

interface AuthValue {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  patchUser: (u: Partial<User>) => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (AUTH_MODE === 'bearer' && !getToken()) { setStatus('out'); return; }
    const ctl = new AbortController();
    api.me({ signal: ctl.signal }).then(
      u => { setUser(u); setStatus('in'); },
      () => { if (!ctl.signal.aborted) { setToken(null); setStatus('out'); } },
    );
    return () => ctl.abort();
  }, []);

  useEffect(() => {
    const out = () => { setToken(null); setUser(null); setStatus('out'); };
    window.addEventListener(UNAUTHORIZED_EVENT, out);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, out);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    if (AUTH_MODE === 'bearer') setToken(r.token ?? null);
    setUser(r.user);
    setStatus('in');
    ignoreErrors(() => localStorage.setItem('enerops-operator', r.user.email));
    return r.user;
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setToken(null); setUser(null); setStatus('out');
  }, []);

  const patchUser = useCallback((u: Partial<User>) => setUser(p => (p ? { ...p, ...u } : p)), []);
  const value = useMemo(() => ({ status, user, signIn, signOut, patchUser }), [status, user, signIn, signOut, patchUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
