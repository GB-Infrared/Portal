import { useEffect, useId, useState, type ReactNode } from 'react';

export interface Opt { v: string; t: ReactNode; extra?: ReactNode }

const OPEN_EVENT = 'enerops:pick-open';

export function usePanelOpen(): [boolean, (on: boolean) => void] {
  const id = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const other = (e: Event) => { if ((e as CustomEvent).detail !== id) setOpen(false); };
    const doc = () => setOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener(OPEN_EVENT, other);
    document.addEventListener('click', doc);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener(OPEN_EVENT, other);
      document.removeEventListener('click', doc);
      document.removeEventListener('keydown', key);
    };
  }, [id]);
  const set = (on: boolean) => {
    if (on) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setOpen(on);
  };
  return [open, set];
}

type Variant = 'm' | 'col';
const cls = (v: Variant) => v === 'm'
  ? { pan: 'mpanel', head: 'mhead', row: 'mrow', foot: 'mfoot' }
  : { pan: 'colpanel mpanel', head: 'colhead', row: 'colrow', foot: 'colfoot' };

interface SingleProps {
  value: string;
  options: Opt[];
  onChange: (v: string) => void;
  head: ReactNode;
  variant?: Variant;
  className?: string;
  title?: string;
  dim?: (v: string) => boolean;
  id?: string;
}

export function SingleSelect({ value, options, onChange, head, variant = 'col', className, title, dim, id }: SingleProps) {
  const [open, setOpen] = usePanelOpen();
  const c = cls(variant);
  const cur = options.find(o => o.v === value);
  const name = useId();
  return (
    <div className={'msel' + (className ? ' ' + className : '') + (open ? ' open' : '')} id={id}>
      <button type="button" className="mbtn" aria-expanded={open} title={title}
              onClick={e => { e.stopPropagation(); setOpen(!open); }}>
        <span className={'mlab' + (dim && dim(value) ? ' off' : '')}>{cur ? cur.t : value}</span>
      </button>
      {open && (
        <div className={c.pan} onClick={e => e.stopPropagation()}>
          <div className={c.head}>{head}</div>
          {options.map(o => (
            <label key={o.v} className={c.row}>
              <input type="radio" name={name} value={o.v} checked={o.v === value}
                     onChange={() => { onChange(o.v); setOpen(false); }} />
              {o.t}{o.extra}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

interface MultiProps {
  value: string[];
  options: Opt[];
  onChange: (v: string[]) => void;
  head: ReactNode;
  any: string;
  variant?: Variant;
  className?: string;
  title?: string;
}

export function MultiSelect({ value, options, onChange, head, any, variant = 'col', className, title }: MultiProps) {
  const [open, setOpen] = usePanelOpen();
  const c = cls(variant);
  const order = (list: string[]) => options.map(o => o.v).filter(v => list.includes(v));
  const label = !value.length ? any
    : value.length === 1 ? (options.find(o => o.v === value[0])?.t ?? value[0])
    : value.length + ' selected';
  return (
    <div className={'msel' + (className ? ' ' + className : '') + (open ? ' open' : '')}>
      <button type="button" className="mbtn" aria-expanded={open} title={title}
              onClick={e => { e.stopPropagation(); setOpen(!open); }}>
        <span className={'mlab' + (value.length ? '' : ' any')}>{label}</span>
      </button>
      {open && (
        <div className={c.pan} onClick={e => e.stopPropagation()}>
          <div className={c.head}>{head}</div>
          {options.map(o => (
            <label key={o.v} className={c.row}>
              <input type="checkbox" value={o.v} checked={value.includes(o.v)}
                     onChange={e => onChange(order(e.target.checked ? [...value, o.v] : value.filter(x => x !== o.v)))} />
              {o.t}{o.extra}
            </label>
          ))}
          <div className={c.foot}>
            <button type="button" onClick={() => onChange(options.map(o => o.v))}>All</button>
            <button type="button" onClick={() => onChange([])}>None</button>
          </div>
        </div>
      )}
    </div>
  );
}
