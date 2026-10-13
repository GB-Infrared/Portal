import { useCallback, useEffect, useRef, useState } from 'react';

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
