import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getToken, setToken, UNAUTHORIZED_EVENT } from '../api/client';
import { AUTH_MODE } from '../api/config';
import * as api from '../api/portal';
import type { User } from '../api/types';

/* WHO IS SIGNED IN.

   On load the session is checked with the backend (GET me) rather than
   trusted from storage: a token the server has since revoked must not open the
   portal. Any 401 from any screen ends the session and sends the reader back to
   the sign-in. */

type Status = 'checking' | 'in' | 'out';

interface AuthValue {
  status: Status;
  user: User | null;
  /** throws ApiError when the backend refuses */
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    /* bearer mode with no token: nothing to check, the answer is "out" */
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
    try { localStorage.setItem('enerops-operator', r.user.email); } catch { /* optional */ }
    return r.user;
  }, []);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch { /* the session ends here either way */ }
    setToken(null); setUser(null); setStatus('out');
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
