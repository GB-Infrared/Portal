import { useRef, useState, type JSX, type MouseEvent } from 'react';
import { pad } from '../lib/format';
import { cssRect, cssX, cssY } from '../lib/screen';

export interface ARow { t: number; v1: Record<string, number | null>; v2: Record<string, number | null> }
export interface ALine { id: string; name: string; which: 1 | 2; color: string; tag: string; unit: string }

const ML = 58, MT = 16, MB = 40;

export function niceScale(mn: number, mx: number): [number, number] {
  if (!Number.isFinite(mn) || !Number.isFinite(mx)) return [0, 1];
  if (mn === 0 && mx === 0) return [0, 1];
  if (mn >= 0 && mn <= 0.25 * mx) mn = 0;
  if (mx <= 0 && mn < 0 && mx >= 0.25 * mn) mx = 0;
  if (mx === mn) mx = mn + (Math.abs(mn) || 1) * 0.05;
  const raw = (mx - mn) / 4;
  const e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  return [Math.floor(mn / step) * step, Math.ceil(mx / step) * step];
}

export const fmtNum = (v: number) => Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2);
const axNum = (v: number) => Math.abs(v) < 1e-9 ? '0'
  : Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(Math.abs(v) >= 1 ? 1 : 2);

export const stampMs = (ms: number) => {
  const d = new Date(ms);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
};

const TSTEPS = [6e4, 12e4, 3e5, 6e5, 9e5, 18e5, 36e5, 72e5, 108e5, 216e5, 432e5, 864e5, 1728e5, 6048e5, 12096e5];
function timeTicks(from: number, to: number, maxN: number) {
  const span = to - from;
  let step = TSTEPS[TSTEPS.length - 1];
  for (const s of TSTEPS) { if (span / s <= maxN) { step = s; break; } }
  const d0 = new Date(from); d0.setHours(0, 0, 0, 0);
  let t = d0.getTime();
  while (t < from) t += step;
  const out: number[] = [];
  for (; t <= to; t += step) out.push(t);
  return { ticks: out, step };
}
const xLabel = (ms: number, step: number) => {
  const d = new Date(ms);
  return step < 864e5 ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
};

interface Props {
  from: number; to: number;
  rows: ARow[];
  lines: ALine[];
  hasY2: boolean;
  y1Label: string; y2Label: string;
  width: number; height: number;
  note: string | null;
}

export function AnalysisChart({ from, to, rows, lines, hasY2, y1Label, y2Label, width: W, height: H, note }: Props) {
  const svgRef = useRef<SVGSVGElement>(null), wrapRef = useRef<HTMLDivElement>(null);
  const [hov, setHov] = useState<{ i: number; y: number } | null>(null);
  const MR = hasY2 ? 58 : 20;
  const PW = W - ML - MR, PH = H - MT - MB;
  const xOf = (t: number) => ML + (t - from) / Math.max(1, to - from) * PW;

  const extent = (which: 1 | 2): [number, number] | null => {
    let mx = -Infinity, mn = Infinity, any = false;
    for (const r of rows) for (const l of lines) {
      if (l.which !== which) continue;
      const v = (which === 1 ? r.v1 : r.v2)[l.id];
      if (v == null || !Number.isFinite(v)) continue;
      any = true; if (v > mx) mx = v; if (v < mn) mn = v;
    }
    return any ? niceScale(mn, mx) : null;
  };
  const e1 = note ? null : extent(1), e2 = note || !hasY2 ? null : extent(2);
  const steps = 4;
  const tt = timeTicks(from, to, Math.max(2, Math.min(14, Math.floor(PW / 86))));

  const axes: JSX.Element[] = [];
  if (e1 || e2) for (let i = 0; i <= steps; i++) {
    const y = MT + PH * (i / steps);
    axes.push(<line key={'g' + i} className="gl" x1={ML} y1={y.toFixed(1)} x2={W - MR} y2={y.toFixed(1)} />);
  }
  const scale = (e: [number, number], anchor: 'end' | 'start', x: number, k: string) => {
    for (let i = 0; i <= steps; i++) {
      const v = e[1] - (e[1] - e[0]) * (i / steps), y = MT + PH * (i / steps);
      axes.push(<text key={k + i} className="axt" x={x} y={(y + 3.5).toFixed(1)} textAnchor={anchor}>{axNum(v)}</text>);
    }
  };
  if (e1) scale(e1, 'end', ML - 8, 'a');
  if (e2) scale(e2, 'start', W - MR + 8, 'b');
  tt.ticks.forEach(t => {
    const x = xOf(t);
    axes.push(<line key={'v' + t} className="gl v" x1={x.toFixed(1)} y1={MT} x2={x.toFixed(1)} y2={MT + PH} />,
      <text key={'x' + t} className="axt" x={x.toFixed(1)} y={H - 14} textAnchor="middle">{xLabel(t, tt.step)}</text>);
  });
  const title = (txt: string, which: string, x: number, dashed: boolean) => (
    <g key={which} transform={`translate(${x},${MT + PH / 2}) rotate(-90)`}>
      <text className="axtitle" x="0" y="0" textAnchor="middle">{which + ' · ' + txt + ' · ' + (dashed ? 'dashed' : 'solid')}</text>
    </g>
  );

  const defs: JSX.Element[] = [], areas: JSX.Element[] = [], paths: JSX.Element[] = [];
  for (const l of lines) {
    const e = l.which === 1 ? e1 : e2; if (!e) continue;
    const yOf = (v: number) => MT + (1 - (v - e[0]) / (e[1] - e[0])) * PH;
    let d = '', pen = false;
    const runs: { x0: number; x1: number; pts: string }[] = [];
    let run: { x0: number; x1: number; pts: string } | null = null;
    for (const r of rows) {
      const v = (l.which === 1 ? r.v1 : r.v2)[l.id];
      if (v == null || !Number.isFinite(v)) { pen = false; run = null; continue; }
      const x = xOf(r.t), y = yOf(v);
      d += (pen ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      if (!run) { run = { x0: x, x1: x, pts: '' }; runs.push(run); }
      run.pts += (run.pts ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      run.x1 = x; pen = true;
    }
    if (!d) continue;
    const gid = 'ar-' + l.id + '-' + l.which;
    defs.push(
      <linearGradient key={gid} id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: l.color }} stopOpacity={l.which === 1 ? 0.26 : 0.16} />
        <stop offset="1" style={{ stopColor: l.color }} stopOpacity="0" />
      </linearGradient>,
    );
    const base = (MT + PH).toFixed(1);
    runs.forEach((r, k) => {
      if (r.x1 === r.x0) return;
      areas.push(<path key={gid + k} d={r.pts.trim() + ' L' + r.x1.toFixed(1) + ' ' + base + ' L' + r.x0.toFixed(1) + ' ' + base + ' Z'} fill={'url(#' + gid + ')'} />);
    });
    paths.push(<path key={gid} d={d.trim()} fill="none" style={{ stroke: l.color }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                     strokeDasharray={l.which === 2 ? '6 4' : undefined} />);
  }

  const onMove = (e: MouseEvent) => {
    const svg = svgRef.current, wrap = wrapRef.current; if (!svg || !wrap || !rows.length || !lines.length) return;
    const r = cssRect(svg);
    const vx = (cssX(e) - r.left) / r.width * W, vy = (cssY(e) - r.top) / r.height * H;
    if (vx < ML || vx > W - MR || vy < MT || vy > MT + PH) { setHov(null); return; }
    const t = from + (vx - ML) / PW * (to - from);
    let bi = 0, bd = Infinity;
    rows.forEach((row, i) => { const dd = Math.abs(row.t - t); if (dd < bd) { bd = dd; bi = i; } });
    setHov({ i: bi, y: cssY(e) - cssRect(wrap).top });
  };
  let tip: JSX.Element | null = null, xh = NaN;
  if (hov && svgRef.current && wrapRef.current) {
    const row = rows[hov.i];
    const items = lines.map(l => ({ l, v: (l.which === 1 ? row.v1 : row.v2)[l.id] })).filter(x => x.v != null && Number.isFinite(x.v));
    if (items.length) {
      xh = xOf(row.t);
      const r = cssRect(svgRef.current), wr = cssRect(wrapRef.current);
      let lx = (xh / W) * r.width + (r.left - wr.left) + 14; if (lx + 190 > wr.width) lx -= 214;
      tip = (
        <div className="tip" id="tip" style={{ left: Math.max(4, lx), top: Math.max(6, hov.y - 18), opacity: 1 }}>
          <div className="tt">{stampMs(row.t)}</div>
          {items.map(({ l, v }) => (
            <div className="tr" key={l.id + l.which}>
              <i className={l.which === 1 ? 'solid' : 'dash'} style={{ borderTopColor: l.color }} />
              {l.name} <span style={{ opacity: 0.7 }}>{l.tag}</span><b>{fmtNum(v as number) + (l.unit ? ' ' + l.unit : '')}</b>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="chartwrap" id="chartwrap" ref={wrapRef}>
      <svg id="chart" ref={svgRef} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
           onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
        <defs id="gdefs">{defs}</defs>
        <g id="axes">
          {axes}
          <text className="axt" x={W / 2} y={H - 1} textAnchor="middle" style={{ letterSpacing: '.08em' }}>{stampMs(from) + '  →  ' + stampMs(to)}</text>
          {e1 && title(y1Label, 'Y1', 14, false)}
          {e2 && title(y2Label, 'Y2', W - 13, true)}
        </g>
        <g id="areas">{areas}</g>
        <g id="series">{paths}</g>
        <line id="xh" x1={Number.isFinite(xh) ? xh : 0} x2={Number.isFinite(xh) ? xh : 0} y1={MT} y2={MT + PH} strokeWidth="1" opacity={Number.isFinite(xh) ? 0.25 : 0} />
      </svg>
      {tip}
      {note && <div className="chartnote" id="chartnote">{note}</div>}
    </div>
  );
}
