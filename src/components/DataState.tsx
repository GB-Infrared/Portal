import type { CSSProperties } from 'react';
import { ApiError } from '../api/client';

/* What a panel shows while its data is still coming, or when it could not
   come. Styles in base.css (.dstate). */

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

/** Loading, failed, or nothing - for panels that render their own content once data is here. */
export function DataGate({ loading, error, what, onRetry, style }: {
  loading: boolean; error: Error | null; what: string; onRetry?: () => void; style?: CSSProperties;
}) {
  if (error) return <Failed error={error} what={what} onRetry={onRetry} style={style} />;
  if (loading) return <Waiting what={'Loading ' + what} style={style} />;
  return null;
}
