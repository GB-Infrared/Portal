import { useState, type ReactNode } from 'react';
import { DataGate } from '../../components/DataState';
import type { ApiState } from '../../hooks/useApi';
import { I_BIN, I_PEN, Rowbtn } from '../settings/common';
import { SsSelect, type SsOpt } from '../settings/SsSelect';

interface Col { t: string; num?: boolean }
const PER: SsOpt[] = ['25', '50', '100'].map(v => ({ v, t: v }));

export function Grid<T>({ cols, rows, row, empty, state, what }: {
  cols: Col[]; rows: T[] | null; row: (r: T) => ReactNode; empty: string; state?: Pick<ApiState<unknown>, 'loading' | 'error' | 'reload'>; what: string;
}) {
  const [per, setPer] = useState(25);
  const [pg, setPg] = useState(0);
  const list = rows ?? [];
  const pages = Math.max(1, Math.ceil(list.length / per));
  const page = Math.min(pg, pages - 1);
  const from = page * per, slice = list.slice(from, from + per);
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead><tr>{cols.map((c, i) => <th key={i} className={c.num ? 'num' : c.t === '' ? 'acts' : undefined}>{c.t}</th>)}</tr></thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={cols.length}><DataGate loading={state?.loading ?? false} error={state?.error ?? null} what={what} onRetry={state?.reload} /></td></tr>
            ) : !slice.length ? (
              <tr><td colSpan={cols.length}><div className="empty-note">{empty}</div></td></tr>
            ) : slice.map(row)}
          </tbody>
        </table>
      </div>
      <div className="tfoot">
        <span>Rows per page</span>
        <SsSelect className="mini perbtn" label="Rows per page" value={String(per)} options={PER} onPick={v => { setPer(Number(v)); setPg(0); }} />
        <span className="sp" />
        <span className="range">{list.length ? `${from + 1}-${from + slice.length} of ${list.length}` : '0-0 of 0'}</span>
        <button className="pgbtn" type="button" disabled={page <= 0} onClick={() => setPg(page - 1)}>&lsaquo;</button>
        <button className="pgbtn" type="button" disabled={page >= pages - 1} onClick={() => setPg(page + 1)}>&rsaquo;</button>
      </div>
    </>
  );
}

export function RowActs({ onEdit, onDel }: { onEdit?: () => void; onDel?: () => void }) {
  return (
    <div className="rowacts">
      {onEdit && <Rowbtn title="Edit" onClick={onEdit}>{I_PEN}</Rowbtn>}
      {onDel && <Rowbtn warn title="Delete" onClick={onDel}>{I_BIN}</Rowbtn>}
    </div>
  );
}

export function Filt({ id, label, value, options, onPick }: { id: string; label: string; value: string; options: SsOpt[]; onPick: (v: string) => void }) {
  return (
    <div className="filt">
      <span className="fl">{label}</span>
      <SsSelect id={id} label={label} any="None" empty="Nothing here yet" value={value} options={options} onPick={onPick} />
    </div>
  );
}

export const count = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);

export function also(plants: number | null, loggers: number | null, devices: number | null): string {
  const p: string[] = [];
  if (plants) p.push(count(plants, 'plant'));
  if (loggers) p.push(count(loggers, 'logger'));
  if (devices) p.push(count(devices, 'device'));
  if (!p.length) return '';
  return ' Its ' + (p.length > 1 ? p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1] : p[0]) + ' are removed with it.';
}

export const dash = (v: string | number | null | undefined) => (v === '' || v === null || v === undefined ? '—' : String(v));
