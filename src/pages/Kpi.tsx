import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type MouseEvent } from 'react';
import * as api from '../api/portal';
import type { KpiBucket, KpiMetric } from '../api/types';
import { useSite } from '../auth/SiteContext';
import { Failed, Waiting } from '../components/DataState';
import { MonthPicker } from '../components/MonthPicker';
import { RowPopover } from '../components/RowPopover';
import { SingleSelect } from '../components/Select';
import { TableFooter } from '../components/TableFooter';
import { TopBar, refreshMs, type Refresh } from '../components/TopBar';
import { useToast } from '../components/Toasts';
import { useApi } from '../hooks/useApi';
import { downloadCsv } from '../lib/csv';
import { DASH, MON, MONL, pad } from '../lib/format';
import '../styles/pages/kpi.css';

/* KPI - one site, one metric, examined closely: what the plant did (actual),
   what the design model says it should have done (simulated), and what it is
   expected to do (forecast), by day across a month or by month across a year.

   Ported from design-mockup/kpi.html. The buckets come from the backend whole;
   nothing is recomputed here, so this page and any report built on the same
   endpoint cannot disagree. */

const METRICS: { k: KpiMetric; t: string; u: string; dec: number }[] = [
  { k: 'PR', t: 'Performance Ratio', u: '%', dec: 1 },
  { k: 'CUF', t: 'Capacity Factor', u: '%', dec: 1 },
  { k: 'AVAIL', t: 'Availability', u: '%', dec: 1 },
  { k: 'YIELD', t: 'Specific Yield', u: 'kWh/kWp', dec: 2 },
  { k: 'ENERGY', t: 'Energy', u: 'kWh', dec: 0 },
  { k: 'IRR', t: 'Irradiation', u: 'kWh/m²', dec: 2 },
];

/* THREE READINGS, THREE MARKS - and the mark says which kind of claim it is.
   ACTUAL is measured: a BAR, whose height is the whole of it. SIMULATED is a
   model, continuous: a LINE carrying a HOLLOW DOT per bucket, hollow so the bar
   shows through. FORECAST is a set of separate estimates: a FILLED TRIANGLE,
   no line. They differ by form, not only by colour. */
type SK = 'actual' | 'simulated' | 'forecast';
const SERIES: { k: SK; t: string; col: string; mark: 'bar' | 'line' | 'tri' }[] = [
  { k: 'actual', t: 'Actual', col: 'var(--green)', mark: 'bar' },
  { k: 'simulated', t: 'Simulated', col: 'var(--blue)', mark: 'line' },
  { k: 'forecast', t: 'Forecast', col: 'var(--amber)', mark: 'tri' },
];
/* the legend and the tooltip draw what the plot draws */
function Mark({ s }: { s: (typeof SERIES)[number] }) {
  return (
    <svg className="mk" viewBox="0 0 17 12" aria-hidden="true">
      {s.mark === 'bar' ? <rect x="3.5" y="1" width="10" height="10" rx="2.5" fill={s.col} />
        : s.mark === 'tri' ? <path d="M8.5 1.4L14.3 10.2H2.7Z" fill={s.col} />
        : <><path d="M1 6h15" stroke={s.col} strokeWidth="2" strokeLinecap="round" /><circle cx="8.5" cy="6" r="3.1" fill="var(--mkbg)" stroke={s.col} strokeWidth="1.8" /></>}
    </svg>
  );
}

const trim = (v: number, d: number) => Number(v).toFixed(v >= 1000 ? 0 : d);
function niceTop(v: number) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p * 1.08) * p;
}
/* a triangle CENTRED on the point (centroid on the value), equilateral, with
   about the ink of a dot of radius r when s = 1.5r */
const triPath = (x: number, y: number, s: number) =>
  'M' + x.toFixed(1) + ' ' + (y - s).toFixed(1) + 'L' + (x + s * 0.866).toFixed(1) + ' ' + (y + s * 0.5).toFixed(1) +
  'L' + (x - s * 0.866).toFixed(1) + ' ' + (y + s * 0.5).toFixed(1) + 'Z';

interface Row extends KpiBucket { label: string; stamp: string; idx: number }

const ML = 64, MR = 18, MT = 14, MB = 38;

function KpiChart({ rows, live, dec, unit, title, foot, W, H }: {
  rows: Row[]; live: typeof SERIES; dec: number; unit: string; title: string; foot: string; W: number; H: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null), wrapRef = useRef<HTMLDivElement>(null);
  const [hov, setHov] = useState<number | null>(null);
  const PW = W - ML - MR, PH = H - MT - MB;
  const vals: number[] = [];
  rows.forEach(r => live.forEach(s => { const v = r[s.k]; if (v != null && Number.isFinite(v)) vals.push(v); }));
  if (!rows.length || !vals.length) {
    return (
      <div className="chartwrap" id="chartwrap" style={{ minHeight: H }}>
        <svg id="chart" viewBox={`0 0 ${W} ${H}`} />
        <div className="chartnote" id="chartnote">Nothing to plot for this period</div>
      </div>
    );
  }
  const TOP = niceTop(Math.max(...vals)), SLOT = PW / rows.length;
  const Y = (v: number) => MT + PH - (v / TOP) * PH;

  const ax: JSX.Element[] = [];
  for (let i = 0; i <= 5; i++) {
    const v = TOP / 5 * i, y = Y(v);
    ax.push(<line key={'g' + i} className="gl" x1={ML} y1={y.toFixed(1)} x2={W - MR} y2={y.toFixed(1)} />,
      <text key={'t' + i} className="axt" x={ML - 8} y={(y + 3.5).toFixed(1)} textAnchor="end">{trim(v, dec)}</text>);
  }
  const every = SLOT < 26 ? Math.ceil(26 / SLOT) : 1;
  rows.forEach((b, i) => {
    if (i % every) return;
    ax.push(<text key={'x' + i} className="axt" x={(ML + SLOT * i + SLOT / 2).toFixed(1)} y={MT + PH + 16} textAnchor="middle">{b.label}</text>);
  });

  const g: JSX.Element[] = [];
  const actual = live.find(s => s.mark === 'bar');
  if (actual) {
    const abw = Math.max(3, Math.min(26, SLOT * 0.52));
    rows.forEach((b, i) => {
      const v = b.actual; if (v == null || !Number.isFinite(v)) return;
      const x = ML + SLOT * i + (SLOT - abw) / 2, y = Y(v);
      g.push(<rect key={'a' + i} x={x.toFixed(1)} y={y.toFixed(1)} width={abw.toFixed(1)} height={Math.max(1, MT + PH - y).toFixed(1)} rx="2" fill={actual.col} opacity=".92" />);
    });
  }
  /* the mark grows with the slot and then stops; a gap is a gap */
  const r = Math.max(2.8, Math.min(5.4, SLOT * 0.17));
  for (const s of live.filter(x => x.mark !== 'bar')) {
    if (s.mark === 'line') {
      let d = '', pen = false;
      rows.forEach((b, i) => {
        const v = b[s.k]; if (v == null || !Number.isFinite(v)) { pen = false; return; }
        d += (pen ? 'L' : 'M') + (ML + SLOT * i + SLOT / 2).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; pen = true;
      });
      if (d) g.push(<path key={'l' + s.k} d={d.trim()} fill="none" stroke={s.col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />);
    }
    rows.forEach((b, i) => {
      const v = b[s.k]; if (v == null || !Number.isFinite(v)) return;
      const x = ML + SLOT * i + SLOT / 2, y = Y(v);
      g.push(s.mark === 'tri'
        ? <path key={s.k + i} d={triPath(x, y, r * 1.5)} fill={s.col} stroke="var(--panel)" strokeWidth="1" strokeLinejoin="round" />
        : <circle key={s.k + i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} fill="var(--panel)" stroke={s.col} strokeWidth={Math.min(1.8, r * 0.56).toFixed(2)} />);
    });
  }

  const onMove = (e: MouseEvent) => {
    const svg = svgRef.current; if (!svg) return;
    const rc = svg.getBoundingClientRect();
    const vx = (e.clientX - rc.left) / rc.width * W, vy = (e.clientY - rc.top) / rc.height * H;
    if (vx < ML || vx > W - MR || vy < MT || vy > MT + PH) { setHov(null); return; }
    setHov(Math.max(0, Math.min(rows.length - 1, Math.floor((vx - ML) / SLOT))));
  };
  let tip: JSX.Element | null = null;
  if (hov !== null && svgRef.current && wrapRef.current) {
    const b = rows[hov];
    const items = live.map(s => ({ s, v: b[s.k] })).filter(x => x.v != null);
    if (items.length) {
      const rc = svgRef.current.getBoundingClientRect(), wr = wrapRef.current.getBoundingClientRect();
      const cx = ML + (hov + 0.5) * SLOT;
      let lx = (cx / W) * rc.width + (rc.left - wr.left) + 14; if (lx + 180 > wr.width) lx -= 200;
      const peak = Math.max(...items.map(x => x.v as number));
      tip = (
        <div className="tip" id="tip" style={{ left: lx, top: Math.max(4, (Y(peak) / H) * rc.height + (rc.top - wr.top) - 10), opacity: 1 }}>
          {/* a half-elapsed bucket says so, rather than looking like a bad day */}
          <div className="tt">{b.stamp + (b.partial ? ' · in progress' : '')}</div>
          {items.map(({ s, v }) => (
            <div className="tr" key={s.k} style={s.k === 'forecast' ? { opacity: 0.7 } : undefined}><Mark s={s} />{s.t}<b>{trim(v as number, dec) + ' ' + unit}</b></div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="chartwrap" id="chartwrap" ref={wrapRef}>
      <svg id="chart" ref={svgRef} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
        <rect id="hl" x={hov !== null ? (ML + SLOT * hov).toFixed(1) : 0} y={MT} width={SLOT.toFixed(1)} height={PH.toFixed(1)} fill="var(--hover)" opacity={hov !== null ? 1 : 0} />
        <g id="axes">
          {ax}
          {/* the y axis names what it measures and in what */}
          <g transform={`translate(13,${MT + PH / 2}) rotate(-90)`}>
            <text className="axtitle" x="0" y="0" textAnchor="middle">{title.toUpperCase() + (unit ? ' · ' + unit : '')}</text>
          </g>
          <text className="axt" x={ML + PW / 2} y={MT + PH + 32} textAnchor="middle" opacity=".75">{foot}</text>
        </g>
        <g id="bars">{g}</g>
      </svg>
      {tip}
    </div>
  );
}

export default function Kpi() {
  const { site, error: siteErr, reloadSites } = useSite();
  const toast = useToast();
  /* a KPI over a month does not move while you read it: refresh starts Off */
  const [refresh, setRefresh] = useState<Refresh>('off');
  const siteId = site?.id ?? null;

  const now = new Date();
  const [metK, setMetK] = useState<KpiMetric>('PR');
  const met = METRICS.find(m => m.k === metK) ?? METRICS[0];
  const [py, setPy] = useState(now.getFullYear()), [pm, setPm] = useState(now.getMonth());
  const [gran, setGran] = useState<'day' | 'month'>('day');

  const q = useApi(siteId ? s => api.getKpi(siteId, { metric: metK, granularity: gran, year: py, month: gran === 'day' ? pm + 1 : undefined }, { signal: s }) : null,
    [siteId, metK, gran, py, pm], refreshMs(refresh));

  const rows: Row[] = useMemo(() => (q.data ?? []).map((b, idx) => {
    const p = b.key.split('-').map(Number);
    return gran === 'day'
      ? { ...b, idx, label: pad(p[2]) + ' ' + MON[p[1] - 1], stamp: pad(p[2]) + '.' + pad(p[1]) + '.' + p[0] }
      : { ...b, idx, label: MON[p[1] - 1], stamp: MON[p[1] - 1] + ' ' + p[0] };
  }), [q.data, gran]);

  /* off, not on: a series switched off stays off while you change the metric */
  const [off, setOff] = useState<Record<SK, boolean>>({ actual: false, simulated: false, forecast: false });
  const live = SERIES.filter(s => !off[s.k]);

  const card = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 1000, h: 260 });
  const fit = useCallback(() => {
    const c = card.current; if (!c) return;
    const w = Math.max(320, Math.round(c.clientWidth - 20)), h = Math.round(Math.min(330, Math.max(215, w * 0.20)));
    setSz(s => (s.w === w && s.h === h ? s : { w, h }));
  }, []);
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    if (card.current) ro.observe(card.current);
    return () => ro.disconnect();
  }, [fit, site]);

  /* -------- table: the graph's data, nothing else -------- */
  const [cols, setCols] = useState<SK[]>(['actual', 'simulated', 'forecast']);
  const [sort, setSort] = useState<{ k: 'stamp' | SK; dir: 1 | -1 }>({ k: 'stamp', dir: 1 });
  const [per, setPer] = useState(100), [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows, per, sort]);
  const sorted = useMemo(() => rows.slice().sort((a, b) => {
    const x = sort.k === 'stamp' ? a.idx : a[sort.k], y = sort.k === 'stamp' ? b.idx : b[sort.k];
    /* a bucket with no reading sorts last either way - it is absent, not small */
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    return x < y ? -sort.dir : x > y ? sort.dir : 0;
  }), [rows, sort]);
  const from = page * per, slice = sorted.slice(from, from + per);
  const shown = SERIES.filter(s => cols.includes(s.k));
  const blank = !shown.length || !rows.length;
  const tableRef = useRef<HTMLTableElement>(null);
  const [colOpen, setColOpen] = useState(false);
  const colpick = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colOpen) return;
    const click = (e: globalThis.MouseEvent) => { if (colpick.current && !colpick.current.contains(e.target as Node)) setColOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setColOpen(false); };
    document.addEventListener('click', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key); };
  }, [colOpen]);

  if (!site) {
    return (
      <div className="pg-kpi">
        <TopBar refresh={refresh} onRefresh={setRefresh} />
        <div className="wrap"><div className="card">
          {siteErr ? <Failed error={siteErr} what="your sites" onRetry={reloadSites} /> : <Waiting what="Loading sites" />}
        </div></div>
      </div>
    );
  }

  const cell = (r: Row, k: SK) => { const v = r[k]; return v == null ? DASH : trim(v, met.dec); };
  const sortBy = (k: 'stamp' | SK) => setSort(s => (s.k === k ? { k, dir: (-s.dir) as 1 | -1 } : { k, dir: k === 'stamp' ? 1 : -1 }));
  const arrow = (k: string) => (sort.k === k ? <span className="ar">{sort.dir < 0 ? '▼' : '▲'}</span> : null);
  const exportCsv = () => {
    /* the header carries the metric and its unit: "Actual" in a file opened next week says nothing */
    const head = ['Timestamp', ...shown.map(s => s.t + ' ' + met.k + (met.u ? ' (' + met.u + ')' : ''))];
    downloadCsv('KPI_' + site.name + '_' + met.k + '_' + py + (gran === 'month' ? '' : '-' + pad(pm + 1)) + '.csv',
      [head, ...sorted.map(r => [r.stamp, ...shown.map(s => cell(r, s.k))])]);
    toast('Exported ' + sorted.length + ' rows');
  };

  return (
    <div className="pg-kpi">
      <TopBar refresh={refresh} onRefresh={setRefresh} />
      <div className="toprow">
        <div className="filters">
          {/* one KPI at a time: a second metric on the same axis would be a different unit */}
          <div className="field"><label>KPI metric</label>
            <SingleSelect head="KPI metric" value={metK}
                          options={METRICS.map(m => ({ v: m.k, t: m.t, extra: <span className="unit">{m.u}</span> }))}
                          onChange={v => { setMetK(v as KpiMetric); toast(METRICS.find(m => m.k === v)?.t ?? v); }} /></div>
          <div className="field"><label>Period</label>
            <MonthPicker id="per-pick" label="" year={py} month={pm} yearOnly={gran === 'month'}
                         onPick={(y, m) => { setPy(y); setPm(m); toast((gran === 'month' ? '' : MONL[m] + ' ') + y); }} /></div>
        </div>
      </div>

      <div className="wrap">
        <div className="card" ref={card}>
          <div className="chead">
            <div className="title" id="ch-title">{met.t}</div>
            <div className="legend" id="legend">
              {SERIES.map(s => (
                <span key={s.k} className={'lg' + (off[s.k] ? ' off' : '')} title="Click to hide or show" onClick={() => {
                  const next = { ...off, [s.k]: !off[s.k] };
                  /* the last visible series cannot be switched off */
                  if (SERIES.every(x => next[x.k])) { toast('At least one series stays on'); return; }
                  setOff(next);
                }}><Mark s={s} /><span className="n">{s.t}</span></span>
              ))}
            </div>
            {/* DAY is "what happened this month", MONTH is "how is the year going" */}
            <div className="tools">
              <div className="seg" id="gran">
                <button type="button" className={gran === 'day' ? 'on' : undefined} onClick={() => { if (gran !== 'day') { setGran('day'); toast('Daily · ' + MONL[pm] + ' ' + py); } }}>Daily</button>
                <button type="button" className={gran === 'month' ? 'on' : undefined} onClick={() => { if (gran !== 'month') { setGran('month'); toast('Monthly · ' + py); } }}>Monthly</button>
              </div>
            </div>
          </div>
          {q.data
            ? <KpiChart rows={rows} live={live} dec={met.dec} unit={met.u} title={met.t} W={sz.w} H={sz.h}
                        foot={gran === 'month' ? py + ' · MONTH' : (MONL[pm] + ' ' + py + ' · DAY').toUpperCase()} />
            : <div className="chartwrap" style={{ height: sz.h + 18 }}>
                {q.error ? <Failed error={q.error} what={met.t} onRetry={q.reload} style={{ height: '100%' }} /> : <Waiting what={'Loading ' + met.t} style={{ height: '100%' }} />}
              </div>}
        </div>

        <div className="card">
          <div className="chead"><div className="title" id="tb-title">{met.t} · Data</div></div>
          <div className="ttools">
            <div className="colpick" id="colpick" ref={colpick}>
              <button className="tbtn" id="colbtn" type="button" aria-expanded={colOpen} onClick={e => { e.stopPropagation(); setColOpen(!colOpen); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6.2 7.3v6l-3.6 1.8v-7.8L4 5z" /></svg>FILTER</button>
              {colOpen && (
                <div className="colpanel" id="colpanel">
                  <div className="colhead">Shown in the table and the export</div>
                  <label className="colrow locked"><input type="checkbox" checked disabled />Timestamp<span className="req">REQUIRED</span></label>
                  <div className="coldiv" />
                  {SERIES.map(s => (
                    <label className="colrow" key={s.k}>
                      <input type="checkbox" checked={cols.includes(s.k)} onChange={e => {
                        const next = e.target.checked ? [...cols, s.k] : cols.filter(x => x !== s.k);
                        setCols(SERIES.map(x => x.k).filter(x => next.includes(x)));
                        if (!e.target.checked && sort.k === s.k) setSort({ k: 'stamp', dir: 1 });
                      }} />
                      <span className="swatch" style={{ background: s.col }} />{s.t}
                    </label>
                  ))}
                  <div className="colfoot">
                    <button type="button" onClick={() => setCols(SERIES.map(s => s.k))}>All</button>
                    <button type="button" onClick={() => { setCols([]); setSort({ k: 'stamp', dir: 1 }); }}>None</button>
                  </div>
                </div>
              )}
            </div>
            <button className="tbtn" type="button" onClick={exportCsv}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11m0 0-4.2-4.2M12 15l4.2-4.2M4.5 20h15" /></svg>EXPORT CSV</button>
          </div>
          <div className="tablewrap">
            <table ref={tableRef}>
              <thead>
                {blank
                  ? <tr><th className="ts">Timestamp</th>{SERIES.map(s => <th key={s.k} className="ph">{s.t}</th>)}</tr>
                  : <tr>
                      <th className={'so ts' + (sort.k === 'stamp' ? ' on' : '')} onClick={() => sortBy('stamp')} title="Sort by Timestamp">Timestamp{arrow('stamp')}</th>
                      {shown.map(s => <th key={s.k} className={'so' + (sort.k === s.k ? ' on' : '')} onClick={() => sortBy(s.k)} title={'Sort by ' + s.t}>{s.t}{arrow(s.k)}</th>)}
                    </tr>}
              </thead>
              <tbody>
                {!q.data ? (
                  <tr><td colSpan={4}>{q.error ? <Failed error={q.error} what={met.t} onRetry={q.reload} /> : <Waiting what="Loading" />}</td></tr>
                ) : blank ? (
                  <tr><td colSpan={4}><div className="empty-note tall">{!rows.length ? 'Nothing in this period' : 'No columns selected'}</div></td></tr>
                ) : slice.map(r => (
                  <tr key={r.key}><td className="ts">{r.stamp}</td>{shown.map(s => <td key={s.k}>{cell(r, s.k)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter per={per} onPer={setPer} from={from} shown={blank ? 0 : slice.length} total={blank ? 0 : sorted.length}
                       onPage={d => setPage(p => Math.max(0, p + d))} />
        </div>
      </div>
      <RowPopover tableRef={tableRef} />
    </div>
  );
}
