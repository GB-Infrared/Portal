import { useMemo, useRef, useState, type JSX, type MouseEvent } from 'react';
import type { DayPowerSeries } from '../api/types';
import { hourLabel, time12, toDate, MONL } from '../lib/format';
import { areaPath, hourOfDay, lastIndexWithValue, linePath, niceMax } from './util';
import { cssRect, cssX } from '../lib/screen';

const L = 46, R = 58, T = 14, B = 34, IMAX = 1000;

export interface PowerChartProps {
  data: DayPowerSeries;
  width: number;
  height: number;
  selected: string[];
  off: Record<string, boolean>;
  colorOf: (id: string) => string;
  warnIds: Set<string>;
  live: boolean;
}

export function PowerChart({ data, width: W, height: H, selected, off, colorOf, warnIds, live }: PowerChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const PW = W - L - R, PH = H - T - B;
  const plant = selected.length === 0;

  const g = useMemo(() => {
    const hrs = data.times.map(t => { const d = toDate(t); return d ? hourOfDay(d) : NaN; });
    const has = (i: number) => data.plantKw[i] != null || data.irradianceWm2[i] != null ||
      data.devices.some(d => d.kw[i] != null);
    let lo = Infinity, hi = -Infinity;
    hrs.forEach((h, i) => { if (Number.isFinite(h) && has(i)) { lo = Math.min(lo, h); hi = Math.max(hi, h); } });
    if (!Number.isFinite(lo)) { lo = 6; hi = 19; }
    const day0 = Math.max(0, Math.min(5, Math.floor(lo) - 1)), day1 = Math.min(24, Math.max(20, Math.ceil(hi) + 1));
    const span = Math.max(1, day1 - day0);

    let peak = 0;
    const consider = (ys: (number | null)[]) => ys.forEach(v => { if (v != null && v > peak) peak = v; });
    if (plant) { if (!off.power) consider(data.plantKw); }
    else data.devices.forEach(d => { if (selected.includes(d.id) && !off[d.id]) consider(d.kw); });
    const { max, step } = niceMax(peak || 1);
    return { hrs, day0, day1, span, pmax: max, pstep: step };
  }, [data, plant, off, selected]);

  const X = (h: number) => L + (h - g.day0) / g.span * PW;
  const Y = (v: number) => T + (1 - v / g.pmax) * PH;
  const Yi = (v: number) => T + (1 - v / IMAX) * PH;
  const xs = g.hrs.map(h => (Number.isFinite(h) ? X(h) : NaN));
  const floorY = Y(0);

  const day = toDate(data.date + 'T00:00:00');
  const dayLabel = day ? (day.getDate() + ' ' + MONL[day.getMonth()] + ' ' + day.getFullYear()).toUpperCase() : '';

  const axes: JSX.Element[] = [];
  for (let v = 0; v <= g.pmax + 1e-9; v += g.pstep) {
    const y = Y(v);
    axes.push(<line key={'g' + v} className="gl" x1={L} y1={y} x2={W - R} y2={y} />,
      <text key={'t' + v} className="axt" x={L - 8} y={y + 3.5} textAnchor="end">{+v.toFixed(2)}</text>);
  }
  for (let v = 0; v <= IMAX; v += 200) {
    axes.push(<text key={'i' + v} className="axt amber" x={W - R + 8} y={Yi(v) + 3.5} textAnchor="start">{v}</text>);
  }
  const hStep = PW < 560 ? 4 : 2;
  for (let h = g.day0 + 1; h <= g.day1 - 1; h += hStep) {
    const x = X(h);
    axes.push(<line key={'v' + h} className="gl v" x1={x} y1={T} x2={x} y2={T + PH} />,
      <text key={'h' + h} className="axt" x={x} y={H - 14} textAnchor="middle">{hourLabel(h)}</text>);
  }

  const lastPlant = lastIndexWithValue(data.plantKw);
  const lastAny = Math.max(lastPlant, lastIndexWithValue(data.irradianceWm2));
  const xe = lastAny >= 0 ? xs[lastAny] : NaN;

  let multi: JSX.Element | null = null;
  if (!plant) {
    const areas: JSX.Element[] = [], lines: JSX.Element[] = [], dots: JSX.Element[] = [];
    for (const d of data.devices) {
      if (!selected.includes(d.id) || off[d.id]) continue;
      const c = colorOf(d.id);
      areas.push(<path key={'a' + d.id} d={areaPath(xs, d.kw, Y, floorY)} fill={'url(#' + (warnIds.has(d.id) ? 'gpwb' : 'gpw') + ')'} />);
      lines.push(<path key={'l' + d.id} d={linePath(xs, d.kw, Y)} fill="none" stroke={c} strokeWidth={2}
                       strokeLinejoin="round" strokeLinecap="round"><title>{d.id}</title></path>);
      const li = lastIndexWithValue(d.kw);
      if (live && li >= 0) dots.push(<circle key={'d' + d.id} cx={xs[li]} cy={Y(d.kw[li] as number)} r={3.6} fill={c} stroke="var(--panel)" strokeWidth={1.4} />);
    }
    multi = <g id="pw-multi">{areas}{lines}{dots}</g>;
  }

  const onMove = (e: MouseEvent) => {
    const svg = svgRef.current; if (!svg) return;
    const r = cssRect(svg);
    const vx = (cssX(e) - r.left) / r.width * W;
    let best = -1, bd = Infinity;
    xs.forEach((x, i) => { if (Number.isFinite(x) && Math.abs(x - vx) < bd) { bd = Math.abs(x - vx); best = i; } });
    if (best < 0 || bd > 30 || (lastAny >= 0 && best > lastAny)) { setHover(null); return; }
    setHover(best);
  };

  let tip: JSX.Element | null = null, xh = NaN;
  if (hover !== null) {
    const rows: [string, string, string][] = [];
    if (plant) { if (!off.power) rows.push(['var(--green)', 'Power', fmt(data.plantKw[hover], 1, ' kW')]); }
    else for (const d of data.devices) if (selected.includes(d.id) && !off[d.id]) rows.push([colorOf(d.id), d.id, fmt(d.kw[hover], 1, ' kW')]);
    if (!off.irradiance) rows.push(['var(--amber)', 'Irradiance', fmt(data.irradianceWm2[hover], 0, ' W/m²')]);
    if (rows.length && svgRef.current && wrapRef.current) {
      xh = xs[hover];
      const r = cssRect(svgRef.current), wr = cssRect(wrapRef.current);
      let lx = (xh / W) * r.width + (r.left - wr.left) + 14; if (lx + 165 > wr.width) lx -= 193;
      const iv = data.irradianceWm2[hover];
      const top = Math.max(4, (Yi(iv ?? 0) / H) * r.height + (r.top - wr.top) - 10);
      tip = (
        <div className="tip" id="pw-tip" style={{ left: lx, top, opacity: 1 }}>
          <div className="tt">{time12(toDate(data.times[hover]))}</div>
          {rows.map(([c, n, v]) => <div className="tr" key={n}><i style={{ background: c }} />{n}<b>{v}</b></div>)}
        </div>
      );
    }
  }

  const showP = plant && !off.power;
  return (
    <div className="chartwrap" id="pw-wrap" ref={wrapRef}>
      <svg id="pw-chart" ref={svgRef} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
           onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="gpw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopOpacity=".34" /><stop offset="1" stopOpacity="0" /></linearGradient>
          <linearGradient id="gpwb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopOpacity=".30" /><stop offset="1" stopOpacity="0" /></linearGradient>
        </defs>
        <g id="pw-axes">
          {axes}
          <text className="axt" transform={`translate(13,${T + PH / 2}) rotate(-90)`} textAnchor="middle" style={{ letterSpacing: '.13em' }}>ACTIVE POWER · kW</text>
          <text className="axt amber" transform={`translate(${W - 11},${T + PH / 2}) rotate(90)`} textAnchor="middle" style={{ letterSpacing: '.13em' }}>IRRADIANCE · W/m²</text>
          <text className="axt" x={W / 2} y={H - 1} textAnchor="middle" style={{ letterSpacing: '.08em' }}>{dayLabel}</text>
        </g>
        {showP && <path id="pw-area" fill="url(#gpw)" d={areaPath(xs, data.plantKw, Y, floorY)} />}
        {multi}
        {!off.irradiance && <path id="pw-ir" fill="none" strokeWidth="1.8" strokeLinejoin="round" strokeDasharray="5 3" opacity=".85" d={linePath(xs, data.irradianceWm2, Yi)} />}
        {showP && <path id="pw-line" fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" d={linePath(xs, data.plantKw, Y)} />}
        {live && Number.isFinite(xe) && <line id="pw-now" x1={xe} x2={xe} y1={16} y2={T + PH} strokeWidth="1" strokeDasharray="3 4" opacity=".55" />}
        {live && showP && lastPlant >= 0 && (
          <g id="pw-dot" transform={`translate(${xs[lastPlant]} ${Y(data.plantKw[lastPlant] as number)})`}>
            <circle className="pulse" r="5" opacity=".6" /><circle r="3.6" strokeWidth="1.4" />
          </g>
        )}
        <line id="pw-xh" x1={Number.isFinite(xh) ? xh : 0} x2={Number.isFinite(xh) ? xh : 0} y1={16} y2={T + PH} strokeWidth="1" opacity={Number.isFinite(xh) ? 0.25 : 0} />
      </svg>
      {tip}
    </div>
  );
}

function fmt(v: number | null | undefined, d: number, unit: string): string {
  return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d) + unit;
}
