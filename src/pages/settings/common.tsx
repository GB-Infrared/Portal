import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ApiError } from '../../api/client';
import { MON, pad, toDate } from '../../lib/format';
import { Modal } from './Modal';

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** held as ISO, printed long: "12 Mar 2021" cannot be read day-for-month */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const q = iso.slice(0, 10).split('-');
  return q.length === 3 ? +q[2] + ' ' + MON[+q[1] - 1] + ' ' + q[0] : iso;
}
/** the moment a row was written, which is not the moment it takes effect */
export function addedStamp(iso: string | null): string {
  const d = toDate(iso);
  return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '—';
}
export function dayBefore(iso: string): string {
  const q = iso.split('-').map(Number), d = new Date(q[0], q[1] - 1, q[2] - 1);
  return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
}
export function plusDay(iso: string): string {
  const q = iso.split('-').map(Number), d = new Date(q[0], q[1] - 1, q[2] + 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
export const asDate = (iso: string) => { const q = iso.split('-').map(Number); return new Date(q[0], q[1] - 1, q[2]); };
export const todayIso = () => { const n = new Date(); return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate()); };
export const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

export const why = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));

/* the marks the tables draw with */
export const I_PEN = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19.2 8.8a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M14.8 5.4l3.8 3.8" /></svg>;
export const I_BOX = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="4.2" rx="1.2" /><path d="M5 8.2V19a1.6 1.6 0 0 0 1.6 1.6h10.8A1.6 1.6 0 0 0 19 19V8.2" /><path d="M10 12.4h4" /></svg>;
export const I_BACK = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11.5a8 8 0 1 1 2.4 5.7" /><path d="M4 5.4v6.1h6.1" /></svg>;
export const I_BIN = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 6.5h15" /><path d="M9.5 6.5V5a1.4 1.4 0 0 1 1.4-1.4h2.2A1.4 1.4 0 0 1 14.5 5v1.5" /><path d="M6.6 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.8-12.5" /><path d="M10.4 10v6.6M13.6 10v6.6" /></svg>;
export const I_PLUS = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;

/** said the way every reading page says it: the same pin, the same mono name */
export function SitePin({ name }: { name: string }) {
  return (
    <span className="sitepin" title="The site every page in this portal is showing. Change it on Site Control.">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21.2s6.8-6 6.8-10.8a6.8 6.8 0 1 0-13.6 0c0 4.8 6.8 10.8 6.8 10.8z" /><circle cx="12" cy="10.2" r="2.5" /></svg>
      <span className="n">{name}</span>
    </span>
  );
}

/** ACTIVE and SUSPENDED - one row per history is green, the rest is what was */
export const Pill = ({ live, yes = 'Active', no = 'Suspended' }: { live: boolean; yes?: string; no?: string }) =>
  <span className={'pill ' + (live ? 'live' : 'held')}><span className="dot" />{live ? yes : no}</span>;

export function Rowbtn({ title, warn, onClick, children }: { title: string; warn?: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={'rowbtn' + (warn ? ' warn' : '')} type="button" title={title} aria-label={title} onClick={onClick}>{children}</button>;
}

/* ---------- one confirm, asked the same way every time ----------
   The record is named before the question is put, the text says what will
   actually happen, and the button says the ACTION rather than "OK". */
interface AskOpts { title: string; rows: [string, string][]; text: ReactNode; go: string; then: () => Promise<void> | void }
const AskCtx = createContext<(o: AskOpts) => void>(() => {});
export const useAsk = () => useContext(AskCtx);

export function AskProvider({ children }: { children: ReactNode }) {
  const [o, setO] = useState<AskOpts | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => { if (!busy) setO(null); }, [busy]);
  return (
    <AskCtx.Provider value={setO}>
      {children}
      {o && (
        <Modal title={o.title} onClose={close}
               foot={<>
                 <button className="btn" type="button" onClick={close}>Cancel</button>
                 <button className="btn danger" type="button" data-autofocus disabled={busy}
                         onClick={async () => { setBusy(true); try { await o.then(); } finally { setBusy(false); setO(null); } }}>{o.go}</button>
               </>}>
          <div className="mwho">{o.rows.map(([k, v]) => <div className="r" key={k}><b>{k}</b><span>{v}</span></div>)}</div>
          <div className="mtext">{o.text}</div>
        </Modal>
      )}
    </AskCtx.Provider>
  );
}
