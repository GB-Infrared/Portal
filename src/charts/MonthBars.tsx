import { useRef, useState, type JSX, type MouseEvent } from 'react';
import { MON, MONL } from '../lib/format';

/* HOME · A MONTH OF DAYS, as bars. Plant Energy Generation (one series) and
   Plant KPI (actual beside simulated) are the same picture: one slot per day,
   the 1st and the last day always named, dates written as densely as the slot
   allows, gridlines kept sparse.

   A day with no value yet - the rest of this month, or a day the backend has
   nothing for - draws a 3px stub on the baseline, not a zero-height bar: it
   is a place a bar will be, not a reading of nothing. Today is drawn at reduced
   opacity because it is still being made. */

export interface BarSeries {
  key: string;
  name: string;
  color: string;
  /** index 0 = day 1 */
  values: (number | null)[];
}

interface Props {
  idp: 'en' | 'cuf';
  year: number;
  month: number;                /* 1-12 */
  series: BarSeries[];
  yMax: number;
  yStep: number;
  yDecimals?: number;
  yTitle: string;
  unit: (v: number) => string;
  today: number | null;         /* day of month, when this month is the current one */
  width: number;
  height: number;
}

const L = 64, R = 16, T = 14, B = 34;

export function MonthBars({ idp, year, month, series, yMax, yStep, yDecimals = 0, yTitle, unit, today, width: W, height: H }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hov, setHov] = useState<number | null>(null);
  const DIM = new Date(year, month, 0).getDate();
  const PW = W - L - R, PH = H - T - B, SLOT = PW / DIM;
  const Y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * PH;
  const single = idp === 'en';

  const axes: JSX.Element[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += yStep) {
    const y = Y(v);
    axes.push(<line key={'g' + v} className="gl" x1={L} y1={y} x2={W - R} y2={y} />,
      <text key={'t' + v} className="axt" x={L - 8} y={y + 3.5} textAnchor="end">{v.toFixed(yDecimals)}</text>);
  }
  const gStep = PW < 560 ? 4 : 2;
  const lStep = SLOT >= 13 ? 1 : (SLOT >= 8.5 ? 2 : 4);
  for (let d = 1; d <= DIM; d++) {
    const x = L + (d - 0.5) * SLOT;
    if (d === 1 || d % gStep === 0) axes.push(<line key={'v' + d} className="gl v" x1={x} y1={T} x2={x} y2={T + PH} />);
    if (d === 1 || d === DIM || d % lStep === 0) axes.push(<text key={'d' + d} className="axt" x={x} y={H - 16} textAnchor="middle" fontSize="9.5">{d}</text>);
  }

  const bars: JSX.Element[] = [];
  const n = series.length || 1;
  const bw = single ? SLOT * 0.68 : SLOT * (n === 1 ? 0.5 : 0.34);
  const gap = single ? 0 : SLOT * 0.06;
  const group = bw * n + gap * (n - 1);
  for (let d = 1; d <= DIM; d++) {
    const x0 = L + (d - 0.5) * SLOT - group / 2;
    series.forEach((s, k) => {
      const v = s.values[d - 1];
      const x = x0 + k * (bw + gap);
      if (v === null || v === undefined || !Number.isFinite(v)) {
        bars.push(<rect key={s.key + d} className={single ? 'bar' : undefined} x={x.toFixed(1)} y={(Y(0) - 3).toFixed(1)} width={bw.toFixed(1)} height="3" rx="1.5" fill="var(--line-soft)" />);
        return;
      }
      bars.push(
        <rect key={s.key + d} className="bar" x={x.toFixed(1)} y={Y(v).toFixed(1)} width={bw.toFixed(1)}
              height={Math.max(0, Y(0) - Y(v)).toFixed(1)} rx={single ? 2.5 : 1.6} fill={s.color}
              opacity={d === today ? 0.62 : (single ? 0.9 : 0.92)}>
          <title>{d + ' ' + MON[month - 1] + ' · ' + (single ? '' : s.name + ' ') + unit(v)}</title>
        </rect>,
      );
    });
  }

  const onMove = (e: MouseEvent) => {
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect();
    const vx = (e.clientX - r.left) / r.width * W, vy = (e.clientY - r.top) / r.height * H;
    if (vx < L || vx > W - R || vy < T || vy > T + PH || !series.length) { setHov(null); return; }
    setHov(Math.max(1, Math.min(DIM, Math.ceil((vx - L) / SLOT))));
  };

  let tip: JSX.Element | null = null;
  if (hov !== null && svgRef.current && wrapRef.current) {
    const cx = L + (hov - 0.5) * SLOT;
    const r = svgRef.current.getBoundingClientRect(), wr = wrapRef.current.getBoundingClientRect();
    let lx = (cx / W) * r.width + (r.left - wr.left) + 14; if (lx + 165 > wr.width) lx -= 193;
    const top = Math.max(...series.map(s => s.values[hov - 1] ?? 0), 0);
    tip = (
      <div className="tip" id={idp + '-tip'} style={{ left: lx, top: Math.max(4, (Y(top) / H) * r.height + (r.top - wr.top) - 10), opacity: 1 }}>
        <div className="tt">{hov + ' ' + MON[month - 1] + ' ' + year}</div>
        {series.map(s => {
          const v = s.values[hov - 1];
          return <div className="tr" key={s.key}><i style={{ background: s.color }} />{s.name}<b>{v == null ? '—' : unit(v)}</b></div>;
        })}
      </div>
    );
  }

  return (
    <div className="chartwrap" id={idp + '-wrap'} ref={wrapRef}>
      <svg id={idp + '-chart'} ref={svgRef} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
           onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
        <g id={idp + '-axes'}>
          {axes}
          <text className="axt" transform={`translate(${single ? 15 : 14},${T + PH / 2}) rotate(-90)`} textAnchor="middle" style={{ letterSpacing: '.13em' }}>{yTitle}</text>
          <text className="axt" x={W / 2} y={H - 2} textAnchor="middle" style={{ letterSpacing: '.08em' }}>{(MONL[month - 1] + ' ' + year).toUpperCase()} · DAY</text>
        </g>
        <rect id={idp + '-hl'} fill="var(--hover-soft)" rx="3"
              x={hov ? (L + (hov - 1) * SLOT).toFixed(1) : 0} y={T} width={SLOT.toFixed(1)} height={PH.toFixed(1)}
              opacity={hov ? 1 : 0} />
        <g id={idp + '-bars'}>{bars}</g>
      </svg>
      {tip}
    </div>
  );
}
