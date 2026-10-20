import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { placePanel, type SsOpt } from '../settings/SsSelect';

const OPEN = 'enerops:ss-open';

interface Props {
  value: string[];
  options: SsOpt[];
  onChange: (v: string[]) => void;
  label: string;
  any: string;
  none: string;
  id?: string;
}

export function SsMulti({ value, options, onChange, label, any, none, id }: Props) {
  const me = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const pan = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState(-1);
  const text = !options.length ? none : !value.length ? any : options.filter(o => value.includes(o.v)).map(o => o.t).join(', ');

  const show = (on: boolean) => {
    if (on) { window.dispatchEvent(new CustomEvent(OPEN, { detail: me })); setHere(0); }
    setOpen(on);
  };
  const toggle = (i: number) => {
    const o = options[i]; if (!o) return;
    const next = value.includes(o.v) ? value.filter(x => x !== o.v) : [...value, o.v];
    onChange(options.map(x => x.v).filter(v => next.includes(v)));
  };

  useEffect(() => {
    const other = (e: Event) => { if ((e as CustomEvent).detail !== me) setOpen(false); };
    window.addEventListener(OPEN, other);
    return () => window.removeEventListener(OPEN, other);
  }, [me]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pan.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    const place = () => placePanel(btn.current, pan.current);
    document.addEventListener('mousedown', down, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { document.removeEventListener('mousedown', down, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  useLayoutEffect(() => { if (open) placePanel(btn.current, pan.current); }, [open, options.length]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'Tab') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(here); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHere(h => Math.min(options.length - 1, h + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHere(h => Math.max(0, h - 1)); }
  };

  return (
    <>
      <button ref={btn} className="mbtn" type="button" id={id} aria-haspopup="true" aria-expanded={open}
              onClick={e => { e.stopPropagation(); show(!open); }} onKeyDown={onKey}>
        <span className={'mlab' + (value.length ? '' : ' any')}>{text}</span>
      </button>
      {open && (
        <div ref={pan} className="colpanel mpanel on" onMouseDown={e => e.preventDefault()}>
          <div className="colhead">{label}</div>
          {options.length ? options.map((o, i) => (
            <label key={o.v} className={'colrow' + (i === here ? ' here' : '')} onMouseMove={() => setHere(i)}>
              <input type="checkbox" checked={value.includes(o.v)} onChange={() => toggle(i)} />
              <span className="t">{o.t}</span>{o.s && <span className="s">{o.s}</span>}
            </label>
          )) : <div className="colnone">{none}</div>}
        </div>
      )}
    </>
  );
}
