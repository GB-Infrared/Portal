import { useEffect, useRef, useState } from 'react';
import { MON, MONL } from '../lib/format';

/* YEAR FIRST, THEN MONTH.

   Opening on a grid of years asks the coarse question first and the fine one
   second, which is the order the answer is actually known in. Picking a year
   moves to that year's months; the head then names it and steps back. The
   charts this drives are whole-month series, so a day grid would ask a
   question neither can answer. */

interface Props {
  year: number;
  month: number;            /* 0-11 */
  onPick: (year: number, month: number) => void;
  label?: string;
  id?: string;
  /** KPI's monthly view picks a year only */
  yearOnly?: boolean;
}

const YSPAN = 12;

export function MonthPicker({ year, month, onPick, label = 'Month & year', id, yearOnly }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'year' | 'month'>('year');
  const [vy, setVy] = useState(year);
  const [ypage, setYpage] = useState(Math.floor(year / YSPAN) * YSPAN);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  const toggle = () => {
    setVy(year); setYpage(Math.floor(year / YSPAN) * YSPAN); setStep('year'); setOpen(o => !o);
  };

  return (
    <div className="mpick" id={id} ref={root}>
      {label && <span className="fl">{label}</span>}
      <button className="mpick-btn" type="button" onClick={e => { e.stopPropagation(); toggle(); }}>
        <span className="mpick-lab">{yearOnly ? year : MONL[month] + ' ' + year}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 10h17M8 2.8V6M16 2.8V6" />
        </svg>
      </button>
      {open && (
        <div className="mpick-panel" onClick={e => e.stopPropagation()}>
          {step === 'year' ? (
            <>
              <div className="mpick-head">
                <button type="button" aria-label="Earlier years" onClick={() => setYpage(p => p - YSPAN)}>&lsaquo;</button>
                <span className="yr">{ypage} – {ypage + YSPAN - 1}</span>
                <button type="button" aria-label="Later years" onClick={() => setYpage(p => p + YSPAN)}>&rsaquo;</button>
              </div>
              <div className="mpick-grid">
                {Array.from({ length: YSPAN }, (_, i) => ypage + i).map(yy => (
                  <button key={yy} type="button" className={yy === year ? 'on' : undefined}
                          onClick={() => {
                            if (yearOnly) { onPick(yy, month); setOpen(false); }
                            else { setVy(yy); setStep('month'); }
                          }}>{yy}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* the head becomes the way back, so the year is never a dead end */}
              <div className="mpick-head">
                <button type="button" aria-label="Choose another year"
                        onClick={() => { setYpage(Math.floor(vy / YSPAN) * YSPAN); setStep('year'); }}>&lsaquo;</button>
                <span className="yr">{vy}</span><span style={{ width: 26 }} />
              </div>
              <div className="mpick-grid">
                {MON.map((n, i) => (
                  <button key={n} type="button" className={i === month && vy === year ? 'on' : undefined}
                          onClick={() => { onPick(vy, i); setOpen(false); }}>{n}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
