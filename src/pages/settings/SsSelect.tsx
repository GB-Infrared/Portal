import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/* SETTINGS' ONE-OF-MANY. Monitoring's markup (a .mbtn carrying the current
   value, a .colpanel of radio rows, closing on the pick), with what a form
   needs on top: the panel is placed against the viewport and flipped above the
   button when below is the shorter half; the keyboard moves a cursor (.here)
   that is not the selection, so Escape puts the list away untouched; typing
   the first letters finds a row; the ends hold rather than wrap.

   One open at a time across the page. The panel renders where the component
   is - inside the page - so the page's scoped stylesheet reaches it. */

export interface SsOpt { v: string; t: string; s?: string; none?: boolean }

const OPEN = 'enerops:ss-open';

interface Props {
  value: string;
  options: SsOpt[];
  onPick: (v: string) => void;
  label: string;              /* the panel's heading */
  any?: string;               /* what the button says with nothing chosen */
  empty?: string;             /* what the panel says with nothing to offer */
  className?: string;         /* 'mini', 'mini perbtn' */
  id?: string;
  ariaLabel?: string;
}

export function SsSelect({ value, options, onPick, label, any = 'Choose', empty = 'Nothing to choose from', className, id, ariaLabel }: Props) {
  const me = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const pan = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [here, setHere] = useState(-1);
  const typed = useRef({ s: '', at: 0 });
  const cur = options.find(o => o.v === value);

  const show = (on: boolean) => {
    if (on) { window.dispatchEvent(new CustomEvent(OPEN, { detail: me })); setHere(options.findIndex(o => o.v === value)); }
    setOpen(on);
  };
  const pick = (i: number) => { const o = options[i]; if (!o) return; setOpen(false); btn.current?.focus(); onPick(o.v); };

  useEffect(() => {
    const other = (e: Event) => { if ((e as CustomEvent).detail !== me) setOpen(false); };
    window.addEventListener(OPEN, other);
    return () => window.removeEventListener(OPEN, other);
  }, [me]);

  /* close on a mousedown ELSEWHERE, in the capture phase, so a control that
     stops its own click still closes this list */
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
  useEffect(() => {
    if (!open || here < 0) return;
    pan.current?.querySelector('#' + CSS.escape(me + 'r' + here))?.scrollIntoView({ block: 'nearest' });
  }, [here, open, me]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(true); }
      return;
    }
    /* Escape closes the list and STOPS: the dialog under it listens for Escape too */
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'Tab') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); pick(here); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHere(h => Math.min(options.length - 1, h + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHere(h => (h < 0 ? options.length - 1 : Math.max(0, h - 1))); return; }
    if (e.key === 'Home') { e.preventDefault(); setHere(0); return; }
    if (e.key === 'End') { e.preventDefault(); setHere(options.length - 1); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const now = Date.now();
      typed.current = { s: ((now - typed.current.at < 900 ? typed.current.s : '') + e.key).toLowerCase(), at: now };
      const s = typed.current.s, n = options.length, from = (here < 0 ? 0 : here) + (s.length > 1 ? 0 : 1);
      for (let hop = 0; hop < n; hop++) {
        const i = ((from + hop) % n + n) % n;
        if (options[i].t.toLowerCase().startsWith(s)) { setHere(i); return; }
      }
    }
  };

  return (
    <>
      <button ref={btn} className={'mbtn' + (className ? ' ' + className : '')} type="button" id={id} value={value}
              aria-haspopup="true" aria-expanded={open} aria-label={ariaLabel}
              aria-activedescendant={open && here >= 0 ? me + 'r' + here : undefined}
              onClick={e => { e.stopPropagation(); show(!open); }} onKeyDown={onKey}>
        <span className={'mlab' + (!cur || cur.v === '' ? ' any' : '')}>{cur ? cur.t : any}</span>
      </button>
      {open && (
        <div ref={pan} className="colpanel mpanel on" onMouseDown={e => e.preventDefault()}>
          <div className="colhead">{label}</div>
          {options.length ? options.map((o, i) => (
            <label key={o.v} id={me + 'r' + i} className={'colrow' + (o.none ? ' none' : '') + (i === here ? ' here' : '')}
                   onMouseMove={() => setHere(i)}>
              <input type="radio" checked={o.v === value} onChange={() => pick(i)} />
              <span className="t">{o.t}</span>{o.s && <span className="s">{o.s}</span>}
            </label>
          )) : <div className="colnone">{empty}</div>}
        </div>
      )}
    </>
  );
}

/* placed against the viewport, flipped above when below is the shorter half -
   a panel that opens downward into 40px of room is a panel with one row showing */
function placePanel(b: HTMLElement | null, p: HTMLElement | null) {
  if (!b || !p) return;
  const r = b.getBoundingClientRect(), gap = 6, edge = 10;
  p.style.minWidth = Math.max(r.width, 150) + 'px';
  p.style.maxWidth = Math.max(r.width, 300) + 'px';
  p.style.maxHeight = 'none';
  const want = p.offsetHeight;
  const under = window.innerHeight - r.bottom - edge, over = r.top - edge;
  const up = want > under && over > under;
  p.style.maxHeight = Math.max(96, (up ? over : under) - gap) + 'px';
  const h = p.offsetHeight, w = p.offsetWidth;
  p.style.top = (up ? Math.max(edge, r.top - gap - h) : r.bottom + gap) + 'px';
  p.style.left = Math.max(edge, Math.min(r.left, window.innerWidth - edge - w)) + 'px';
}
