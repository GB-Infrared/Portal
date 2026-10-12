import { useRef, useState, type JSX, type MouseEvent } from 'react';
import { MON, MONL, hourLabel, time12, toDate } from '../lib/format';
import { areaPath, hourOfDay, lastIndexWithValue, linePath, niceMax } from './util';

/* MONITORING · ONE TAG, SEVERAL DEVICES.

   Day plots the curve across the whole day. Week and Month cannot: a month at
   five-minute resolution is 9000 points of ink for a question nobody asked.
   They plot each DAY'S PEAK, as bars - a line implies a value between two
   points, and between two days there is nothing to read. The unit is the
   same in all three, so the axis means the same thing.

   Colours are IDENTITIES (--s1, --s2 ...), never the health colours: a line
   and the health dot beside its device must not say two things in one hue. */

export interface MSeries { id: string; name: string; color: string; values: (number | null)[] }
export interface Marker { id: string; at: Date; title: string }

interface Props {
  mode: 'day' | 'days';
  /** day: one ISO time per value. days: one ISO date per bar */
  times: string[];
  series: MSeries[];
  width: number;
  height: number;
  yTitle: string;
  unit: string;
  foot: string;
  /** draw the now-rule, its time tag and the live dots (the day shown is today) */
  live: boolean;
  markers: Marker[];
  emptyNote?: string;
}

const ML = 46, MR = 16, MT = 14, MB = 34;

export function MonitorChart({ mode, times, series, width: W, height: H, yTitle, unit, foot, live, markers, emptyNote }: Props) {
  const svgRef = useRef<SVGSVGElement>(null), wrapRef = useRef<HTMLDivElement>(null);
  const [hov, setHov] = useState<number | null>(null);
  const PW = W - ML - MR, PH = H - MT - MB;

  let peak = 0;
  series.forEach(s => s.values.forEach(v => { if (v != null && v > peak) peak = v; }));
  const { max: YMAX, step } = niceMax(peak || 1);
  const Y = (v: number) => MT + (1 - v / YMAX) * PH;

  const dates = times.map(t => toDate(t));
  const n = times.length;
  const slot = PW / Math.max(1, n);
  const X = mode === 'day'
    ? (i: number) => { const d = dates[i]; return d ? ML + hourOfDay(d) / 24 * PW : NaN; }
    : (i: number) => ML + (i + 0.5) * slot;
  const xs = times.map((_, i) => X(i));

  const axes: JSX.Element[] = [];
  for (let v = 0; v <= YMAX + 1e-9; v += step) {
    const y = Y(v);
    axes.push(<line key={'g' + v} className="gl" x1={ML} y1={y} x2={W - MR} y2={y} />,
      <text key={'t' + v} className="axt" x={ML - 8} y={y + 3.5} textAnchor="end">{+v.toFixed(3)}</text>);
  }
  if (mode === 'day') {
    const hStep = PW < 560 ? 6 : PW < 820 ? 4 : 2;
    for (let h = 0; h <= 24; h += hStep) {
      const x = ML + h / 24 * PW;
      axes.push(<line key={'v' + h} className="gl v" x1={x} y1={MT} x2={x} y2={MT + PH} />,
        <text key={'h' + h} className="axt" x={x} y={H - 13} textAnchor="middle">{hourLabel(h)}</text>);
    }
  } else {
    /* bars sit IN a slot: the date under its middle, the gridline on its edge */
    const lstep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(PW / 22))));
    for (let i = 0; i < n; i++) {
      const xe = ML + i * slot, xm = ML + (i + 0.5) * slot;
      axes.push(<line key={'v' + i} className="gl v" x1={xe.toFixed(1)} y1={MT} x2={xe.toFixed(1)} y2={MT + PH} />);
      if (i === 0 || i === n - 1 || i % lstep === 0)
        axes.push(<text key={'d' + i} className="axt" x={xm.toFixed(1)} y={H - 13} textAnchor="middle">{dates[i]?.getDate() ?? ''}</text>);
    }
    axes.push(<line key="vend" className="gl v" x1={ML + PW} y1={MT} x2={ML + PW} y2={MT + PH} />);
  }

  const body: JSX.Element[] = [];
  let nowX = NaN, lastI = -1;
  if (mode === 'day') {
    series.forEach((s, k) => body.push(<path key={'a' + s.id} d={areaPath(xs, s.values, Y, Y(0))} fill={'url(#mg' + k + ')'} />));
    series.forEach(s => body.push(<path key={'l' + s.id} d={linePath(xs, s.values, Y)} fill="none" style={{ stroke: s.color }}
                                         strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />));
    lastI = Math.max(-1, ...series.map(s => lastIndexWithValue(s.values)));
    if (live && lastI >= 0) nowX = xs[lastI];
  } else {
    const k = series.length;
    const bw = Math.min(26, slot * (k < 2 ? 0.52 : k === 2 ? 0.30 : 0.6 / k)), gap = Math.min(6, slot * 0.06);
    const group = bw * Math.max(1, k) + gap * Math.max(0, k - 1);
    for (let i = 0; i < n; i++) {
      const x0 = ML + (i + 0.5) * slot - group / 2;
      series.forEach((s, j) => {
        const v = s.values[i]; if (v == null) return;
        body.push(<rect key={s.id + i} className="bar" x={(x0 + j * (bw + gap)).toFixed(1)} y={Y(v).toFixed(1)} width={bw.toFixed(1)}
                        height={Math.max(0, Y(0) - Y(v)).toFixed(1)} rx="2" fill={s.color} opacity=".9" />);
      });
    }
  }

  /* hover */
  const onMove = (e: MouseEvent) => {
    const svg = svgRef.current; if (!svg || !n) return;
    const r = svg.getBoundingClientRect();
    const vx = (e.clientX - r.left) / r.width * W, vy = (e.clientY - r.top) / r.height * H;
    if (vx < ML || vx > W - MR || vy < MT || vy > MT + PH) { setHov(null); return; }
    if (mode === 'days') { setHov(Math.max(0, Math.min(n - 1, Math.floor((vx - ML) / slot)))); return; }
    let best = -1, bd = Infinity;
    xs.forEach((x, i) => { if (Number.isFinite(x) && Math.abs(x - vx) < bd) { bd = Math.abs(x - vx); best = i; } });
    if (best < 0 || bd > 24 || (lastI >= 0 && best > lastI)) { setHov(null); return; }
    setHov(best);
  };
  let tip: JSX.Element | null = null, xh = NaN;
  if (hov !== null && series.length && svgRef.current && wrapRef.current) {
    xh = xs[hov];
    const r = svgRef.current.getBoundingClientRect(), wr = wrapRef.current.getBoundingClientRect();
    let lx = (xh / W) * r.width + (r.left - wr.left) + 14; if (lx + 156 > wr.width) lx -= 184;
    const top = Math.max(0, ...series.map(s => s.values[hov] ?? 0));
    const d = dates[hov];
    tip = (
      <div className="tip" id="tip" style={{ left: lx, top: Math.max(6, (Y(top) / H) * r.height + (r.top - wr.top) - 14), opacity: 1 }}>
        <div className="tt">{mode === 'day' ? time12(d) : (d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ' · peak' : '')}</div>
        {series.map(s => {
          const v = s.values[hov];
          return <div className="tr" key={s.id}><i style={{ background: s.color }} />{s.name}<b>{v == null ? '—' : v.toFixed(1) + (unit ? ' ' + unit : '')}</b></div>;
        })}
      </div>
    );
  }

  const tagX = Number.isFinite(nowX) ? (nowX > W - MR - 72 ? nowX - 66 : nowX + 7) : 0;
  const lastAt = lastI >= 0 ? dates[lastI] : null;
  return (
    <div className="chartwrap" id="chartwrap" ref={wrapRef}>
      <svg id="chart" ref={svgRef} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
           onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
        <defs>
          {series.map((s, k) => (
            <linearGradient key={k} id={'mg' + k} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: s.color }} stopOpacity={k === 0 ? 0.32 : 0.26} />
              <stop offset="1" style={{ stopColor: s.color }} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        <g id="axes">
          {axes}
          <text className="axt" x={W / 2} y={H - 1} textAnchor="middle" style={{ letterSpacing: '.08em' }}>{foot}</text>
          <text className="axt" transform={`translate(11,${MT + PH / 2}) rotate(-90)`} textAnchor="middle" style={{ letterSpacing: '.14em' }}>{yTitle}</text>
        </g>
        <g id="bars">{mode === 'days' ? body : null}</g>
        {mode === 'day' ? body : null}
        {mode === 'day' && markers.map(m => {
          const s = series.find(x => x.id === m.id); if (!s) return null;
          const h = hourOfDay(m.at), x = ML + h / 24 * PW;
          /* the reading nearest the moment it started */
          let bi = -1, bd = Infinity;
          dates.forEach((d, i) => { if (d) { const dd = Math.abs(hourOfDay(d) - h); if (dd < bd && s.values[i] != null) { bd = dd; bi = i; } } });
          if (bi < 0) return null;
          return (
            <g key={m.id + m.at.getTime()} id="dropm" transform={`translate(${x} ${Y(s.values[bi] as number) - 13})`}>
              <path d="M-5 -8 L5 -8 L0 0 Z" /><title>{m.title}</title>
            </g>
          );
        })}
        {mode === 'day' && live && Number.isFinite(nowX) && (
          <>
            <line id="nowl" x1={nowX} x2={nowX} y1={MT} y2={MT + PH} strokeWidth="1" strokeDasharray="3 4" opacity=".55" />
            <g id="nowtag" transform={`translate(${tagX} ${MT + 3})`}>
              <rect x="0" y="0" width="58" height="17" rx="4" />
              <text id="nowtxt" x="29" y="12" textAnchor="middle" fontSize="10" fontFamily="ui-monospace,monospace" fontWeight="700">{time12(lastAt)}</text>
            </g>
            {series.map(s => {
              const li = lastIndexWithValue(s.values); if (li < 0) return null;
              return (
                <g key={'d' + s.id} transform={`translate(${xs[li]} ${Y(s.values[li] as number)})`}>
                  <circle className="pulse" r="5" opacity=".6" style={{ fill: s.color }} />
                  <circle r="3.6" strokeWidth="1.4" style={{ fill: s.color, stroke: 'var(--panel)' }} />
                </g>
              );
            })}
          </>
        )}
        {!series.length && emptyNote && (
          <text className="axt" x={ML + PW / 2} y={MT + PH / 2} textAnchor="middle" style={{ fontSize: 12 }}>{emptyNote}</text>
        )}
        <line id="xh" x1={Number.isFinite(xh) ? xh : 0} x2={Number.isFinite(xh) ? xh : 0} y1={MT} y2={MT + PH} strokeWidth="1" opacity={Number.isFinite(xh) ? 0.25 : 0} />
      </svg>
      {tip}
    </div>
  );
}

/** "JULY 20TH 2026" */
export function longDay(d: Date): string {
  const n = d.getDate();
  const ord = n > 3 && n < 21 ? 'TH' : (['TH', 'ST', 'ND', 'RD'][Math.min(n % 10, 4)] || 'TH');
  return MONL[d.getMonth()].toUpperCase() + ' ' + n + ord + ' ' + d.getFullYear();
}
