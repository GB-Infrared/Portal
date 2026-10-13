import type { CSSProperties } from 'react';
import { ApiError } from '../api/client';

export function Waiting({ what = 'Loading', style }: { what?: string; style?: CSSProperties }) {
  return <div className="dstate wait" style={style}><span className="t">{what}…</span></div>;
}

export function Failed({ error, what, onRetry, style }: {
  error: Error; what: string; onRetry?: () => void; style?: CSSProperties;
}) {
  const kind = error instanceof ApiError ? error.kind : 'FAILED';
  return (
    <div className="dstate" style={style} role="alert">
      <span className="k">{kind}</span>
      <span className="t">Could not load {what}</span>
      <span className="s">{error.message}</span>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function NoSite({ loading, error, onRetry }: { loading: boolean; error: Error | null; onRetry: () => void }) {
  if (error) return <Failed error={error} what="your sites" onRetry={onRetry} />;
  if (loading) return <Waiting what="Loading sites" />;
  return <div className="dstate"><span className="t">No sites</span><span className="s">This account has no sites to show.</span></div>;
}

export function DataGate({ loading, error, what, onRetry, style }: {
  loading: boolean; error: Error | null; what: string; onRetry?: () => void; style?: CSSProperties;
}) {
  if (error) return <Failed error={error} what={what} onRetry={onRetry} style={style} />;
  if (loading) return <Waiting what={'Loading ' + what} style={style} />;
  return null;
}
