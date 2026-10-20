import { useState, type CSSProperties, type ReactNode } from 'react';
import { useToast } from '../../components/Toasts';
import { EMAIL, why } from '../settings/common';
import { Modal } from '../settings/Modal';
import { SsSelect, type SsOpt } from '../settings/SsSelect';
import { SsMulti } from './SsMulti';

export type Vals = Record<string, string | string[]>;
type Kind = 'text' | 'email' | 'tel' | 'number' | 'date' | 'password' | 'area' | 'select' | 'multi' | 'checks' | 'ro';

export interface Field {
  k?: string;
  sec?: string;
  label?: string;
  type?: Kind;
  opt?: boolean;
  def?: string | string[];
  show?: (v: Vals) => boolean;
  hide?: boolean;
  newRow?: boolean;
  w?: number;
  span?: boolean;
  hint?: ReactNode;
  any?: string | ((v: Vals) => string);
  opts?: SsOpt[] | ((v: Vals) => SsOpt[]);
  none?: string;
  min?: number;
  max?: number;
}

interface FormSpec {
  title: string;
  go: string;
  wide?: string;
  cols?: number;
  fields: Field[];
  who?: [string, string][];
  values?: Vals;
  check?: (v: Vals) => [string, string] | null;
  save: (v: Vals) => Promise<string>;
}

export const sv = (v: Vals, k: string) => { const x = v[k]; return typeof x === 'string' ? x : ''; };
export const av = (v: Vals, k: string) => { const x = v[k]; return Array.isArray(x) ? x : []; };
const optsOf = (f: Field, v: Vals) => (typeof f.opts === 'function' ? f.opts(v) : f.opts ?? []);
const anyOf = (f: Field, v: Vals) => (typeof f.any === 'function' ? f.any(v) : f.any ?? 'Choose');

function startValues(spec: FormSpec): Vals {
  const v: Vals = { ...(spec.values ?? {}) };
  for (const f of spec.fields) {
    if (!f.k || v[f.k] !== undefined) continue;
    v[f.k] = f.def !== undefined ? (Array.isArray(f.def) ? f.def.slice() : f.def) : (f.type === 'checks' || f.type === 'multi' ? [] : '');
  }
  return v;
}

function problem(f: Field, x: string | string[] | undefined): string {
  const empty = Array.isArray(x) ? !x.length : String(x ?? '').trim() === '';
  const s = Array.isArray(x) ? '' : String(x ?? '').trim();
  if (!f.opt && empty) return f.type === 'checks' ? 'Choose at least one.' : f.type === 'select' ? 'Choose one.' : 'Required.';
  if (empty) return '';
  if (f.type === 'email' && !EMAIL.test(s)) return 'That does not look like an email address.';
  if (f.type === 'number' && !Number.isFinite(+s)) return 'A number, please.';
  if (f.type === 'number' && f.min !== undefined && +s < f.min) return 'At least ' + f.min + '.';
  if (f.type === 'tel' && s.replace(/\D/g, '').length < 7) return 'That does not look like a phone number.';
  return '';
}

function FormDialog({ spec, onClose }: { spec: FormSpec; onClose: () => void }) {
  const toast = useToast();
  const [vals, setVals] = useState<Vals>(() => startValues(spec));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, x: string | string[]) => setVals(v => ({ ...v, [k]: x }));

  const save = async () => {
    const e: Record<string, string> = {};
    for (const f of spec.fields) {
      if (!f.k || (f.show && !f.show(vals))) continue;
      const msg = problem(f, vals[f.k]);
      if (msg) e[f.k] = msg;
    }
    const clean: Vals = Object.fromEntries(Object.entries(vals).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x]));
    if (!Object.keys(e).length && spec.check) { const r = spec.check(clean); if (r) e[r[0]] = r[1]; }
    setErrs(e);
    const first = Object.keys(e)[0];
    if (first) { requestAnimationFrame(() => document.getElementById('ff-' + first)?.focus()); return; }
    setBusy(true);
    try { const msg = await spec.save(clean); onClose(); if (msg) toast(msg); }
    catch (x) { toast('Could not save: ' + why(x), true); }
    finally { setBusy(false); }
  };

  const control = (f: Field, k: string, id: string) => {
    if (f.type === 'ro') return <input id={id} type="text" value={sv(vals, k)} readOnly tabIndex={-1} />;
    if (f.type === 'multi') {
      return <SsMulti id={id} label={f.label ?? ''} any={anyOf(f, vals)} none={f.none ?? 'Nothing to choose from'}
                      value={av(vals, k)} options={optsOf(f, vals)} onChange={x => set(k, x)} />;
    }
    if (f.type === 'select') {
      return <SsSelect id={id} label={f.label ?? ''} any={anyOf(f, vals)} empty="Nothing to choose from"
                       value={sv(vals, k)} options={optsOf(f, vals)} onPick={x => set(k, x)} />;
    }
    if (f.type === 'checks') {
      const o = optsOf(f, vals), on = av(vals, k);
      return (
        <div className="subrow checks">
          {o.length ? o.map(x => (
            <label className="subbox" key={x.v}>
              <input type="checkbox" name={id} checked={on.includes(x.v)}
                     onChange={e => set(k, e.target.checked ? o.map(y => y.v).filter(v => v === x.v || on.includes(v)) : on.filter(v => v !== x.v))} />{x.t}
            </label>
          )) : <span className="mtext">{f.none ?? 'Nothing to choose from'}</span>}
        </div>
      );
    }
    if (f.type === 'area') return <textarea id={id} maxLength={f.max ?? 300} value={sv(vals, k)} onChange={e => set(k, e.target.value)} />;
    return (
      <input id={id} type={f.type ?? 'text'} value={sv(vals, k)} onChange={e => set(k, e.target.value)}
             step={f.type === 'number' ? 'any' : undefined} inputMode={f.type === 'number' ? 'decimal' : undefined}
             autoComplete="off" spellCheck={false} maxLength={f.max ?? 120} />
    );
  };

  return (
    <Modal title={spec.title} onClose={onClose} onSubmit={save} wide={spec.wide} bodyClass="form"
           foot={<><button className="btn" type="button" onClick={onClose}>Cancel</button>
                   <button className="btn primary" type="submit" disabled={busy}>{spec.go}</button></>}>
      {spec.who && <div className="mwho">{spec.who.map(([k, v]) => <div className="r" key={k}><b>{k}</b><span>{v}</span></div>)}</div>}
      <div className="fgrid" style={{ '--cols': spec.cols ?? 2 } as CSSProperties}>
        {spec.fields.map((f, i) => {
          if (f.sec) return <div className="msec" key={'sec' + i}>{f.sec}</div>;
          const k = f.k as string, on = !f.show || f.show(vals);
          if (!on && f.hide) return null;
          const id = 'ff-' + k;
          const pickable = f.type === 'select' || f.type === 'multi' || f.type === 'checks';
          const style = f.newRow || f.w ? { gridColumn: (f.newRow ? '1' : 'auto') + ' / span ' + (f.w || 1) } : undefined;
          return (
            <div className={'fld' + (f.span ? ' span' : '') + (on ? '' : ' off') + (errs[k] ? ' bad' : '')} data-k={k} key={k} style={style}>
              <label className="lab" htmlFor={pickable ? undefined : id}>{f.label}{f.opt && <span className="opt">optional</span>}</label>
              {control(f, k, id)}
              {f.hint && <div className="hint">{f.hint}</div>}
              <div className="err">{errs[k] ?? ''}</div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function useForm() {
  const [form, setForm] = useState<FormSpec | null>(null);
  const el = form && <FormDialog spec={form} onClose={() => setForm(null)} />;
  return [el, setForm] as const;
}
