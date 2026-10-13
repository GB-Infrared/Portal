import { useEffect, useRef } from 'react';
import { usePanelOpen } from './Select';
import { pad } from '../lib/format';

function Bit({ part, n, value, onPick }: { part: 'h' | 'm'; n: number; value: number; onPick: (v: number) => void }) {
  const [open, setOpen] = usePanelOpen();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const l = list.current; if (!open || !l) return;
    const rows = l.querySelectorAll('button'), on = l.querySelector('button.on') as HTMLElement | null;
    if (on) {
      const step = rows.length > 1 ? (rows[1] as HTMLElement).offsetTop - (rows[0] as HTMLElement).offsetTop : on.offsetHeight;
      l.scrollTop = Math.max(0, Math.round((on.offsetTop - l.clientHeight / 2) / step) * step);
    }
  }, [open]);
  return (
    <button type="button" className={'tbit' + (open ? ' open' : '')} data-part={part} aria-label={part === 'h' ? 'Hour' : 'Minute'}
            onClick={e => { e.stopPropagation(); setOpen(!open); }}>
      {pad(value)}
      {open && (
        <div className="tlist" ref={list} onClick={e => e.stopPropagation()}>
          {Array.from({ length: n }, (_, i) => (
            <button key={i} type="button" className={i === value ? 'on' : undefined} onClick={() => { onPick(i); setOpen(false); }}>{pad(i)}</button>
          ))}
        </div>
      )}
    </button>
  );
}

export function TimePick({ value, onValue }: { value: string; onValue: (v: string) => void }) {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || '');
  const h = m ? +m[1] : 0, mi = m ? +m[2] : 0;
  return (
    <div className="tpick">
      <Bit part="h" n={24} value={h} onPick={v => onValue(pad(v) + ':' + pad(mi))} />
      <span className="tsep">:</span>
      <Bit part="m" n={60} value={mi} onPick={v => onValue(pad(h) + ':' + pad(v))} />
    </div>
  );
}
