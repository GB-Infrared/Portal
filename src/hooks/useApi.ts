import { useCallback, useEffect, useRef, useState } from 'react';

/* Load something from the backend and keep it current.

   - data stays on screen while a refresh is in flight, so a five-minute poll
     never blanks the page; `loading` is true only until the first answer.
   - a stale answer (the site changed while it was in flight) is dropped.
   - refreshMs re-asks on an interval; 0 or undefined means only when deps change.
   - loadedAt is when the last good answer arrived. */

export interface ApiState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  loadedAt: Date | null;
  reload: () => void;
}

export function useApi<T>(
  fn: ((signal: AbortSignal) => Promise<T>) | null,
  deps: unknown[],
  refreshMs?: number,
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(!!fn);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  /* new question: forget the old answer, so one site's figures never sit
     under another site's name while the new ones load */
  useEffect(() => {
    setData(null); setError(null); setLoadedAt(null); setLoading(!!fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const f = fnRef.current;
    if (!f) { setLoading(false); return; }
    const ctl = new AbortController();
    f(ctl.signal).then(
      d => { if (!ctl.signal.aborted) { setData(d); setError(null); setLoadedAt(new Date()); setLoading(false); } },
      e => { if (!ctl.signal.aborted) { setError(e instanceof Error ? e : new Error(String(e))); setLoading(false); } },
    );
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!refreshMs || !fn) return;
    const t = setInterval(() => setTick(x => x + 1), refreshMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, ...deps]);

  const reload = useCallback(() => setTick(x => x + 1), []);
  return { data, error, loading, loadedAt, reload };
}
