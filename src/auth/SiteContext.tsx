import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from '../api/portal';
import type { Site } from '../api/types';
import { useAuth } from './AuthContext';

/* WHICH SITE THE PORTAL IS ON. One site, chosen once, on Site Control.

   Every page used to carry a picker of its own - four answers to a question
   that has one. Now: ?plant= in the address wins, because a link that names a
   site is explicit; otherwise the last choice stands (localStorage, so it
   carries from page to page and visit to visit); otherwise the first site the
   backend lists. An id the portfolio does not contain is ignored, so a stale
   bookmark still lands somewhere readable. */

const KEY = 'enerops-plant';

interface SiteValue {
  sites: Site[] | null;
  error: Error | null;
  loading: boolean;
  site: Site | null;
  siteId: string | null;
  setSiteId: (id: string) => void;
  reloadSites: () => void;
}

const Ctx = createContext<SiteValue | null>(null);

function remembered(): string | null {
  const q = new URLSearchParams(window.location.search).get('plant');
  if (q) return q;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [wanted, setWanted] = useState<string | null>(remembered);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status !== 'in') { setSites(null); return; }
    const ctl = new AbortController();
    setLoading(true);
    api.getSites({ signal: ctl.signal }).then(
      s => { setSites(s); setError(null); setLoading(false); },
      e => { if (!ctl.signal.aborted) { setError(e); setLoading(false); } },
    );
    return () => ctl.abort();
  }, [status, tick]);

  const site = useMemo(() => {
    if (!sites || !sites.length) return null;
    return sites.find(s => s.id === wanted) ?? sites[0];
  }, [sites, wanted]);

  useEffect(() => {
    if (site) { try { localStorage.setItem(KEY, site.id); } catch { /* optional */ } }
  }, [site]);

  const setSiteId = useCallback((id: string) => setWanted(id), []);
  const reloadSites = useCallback(() => setTick(t => t + 1), []);

  const value = useMemo(() => ({
    sites, error, loading, site, siteId: site?.id ?? null, setSiteId, reloadSites,
  }), [sites, error, loading, site, setSiteId, reloadSites]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite(): SiteValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSite outside SiteProvider');
  return v;
}
