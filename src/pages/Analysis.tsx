import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api/portal';
import type { Device, TimeSeries } from '../api/types';
import { useSite } from '../auth/SiteContext';
import { AnalysisChart, fmtNum, stampMs, type ALine, type ARow } from '../charts/AnalysisChart';
import { DateInput } from '../components/DateInput';
import { Failed, Waiting } from '../components/DataState';
import { RowPopover } from '../components/RowPopover';
import { SingleSelect, usePanelOpen } from '../components/Select';
import { TableFooter } from '../components/TableFooter';
import { TimePick } from '../components/TimePick';
import { TopBar, refreshMs, type Refresh } from '../components/TopBar';
import { useToast } from '../components/Toasts';
import { CATEGORIES, labelWithUnit, reports, unitOf } from '../config/parameters';
import { useApi } from '../hooks/useApi';
import { downloadCsv } from '../lib/csv';
import { DASH, isoDay } from '../lib/format';
import '../styles/pages/analysis.css';

/* ANALYSIS - several devices, one or two parameters, any window.

   Ported from design-mockup/analysis.html. Every reading on the page comes from
   one set of rows, built from the backend's time series, so the chart and the
   table can never be drawn from different data. No APPLY: the bar applies
   itself. Saved views stay in this browser (localStorage), as in the mockup -
   swap viewsRead/viewsWrite for an endpoint and nothing else changes. */

const NONE = '— None —';
const SLOTS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
/* FOUR SERIES, AND IT IS A COLOUR CAP: in one frame only hue keeps two curves
   apart, and past four there is no fifth that stays clear of the others for a
   colour-blind reader. A fifth device is selected, and in the table. */
const PLOTCAP = 4;
const catOf = (k: string) => CATEGORIES.find(c => c.k === k);
const tagsOf = (k: string) => catOf(k)?.vals.map(v => v.tag) ?? [];

/* The window sets the resolution, not a control: climb the ladder until the
   point count fits. A month at five minutes is nine thousand points of ink. */
const LADDER = [1, 5, 15, 30, 60, 180, 360, 720, 1440];
const MAXPTS = 1100;
function intervalFor(spanMs: number): string {
  let m = LADDER[LADDER.length - 1];
  for (const x of LADDER) if (spanMs / (x * 60000) <= MAXPTS) { m = x; break; }
  return m >= 1440 ? m / 1440 + 'd' : m >= 60 ? m / 60 + 'h' : m + 'm';
}

/* ---------- saved views ---------- */
interface Query { dev: string[]; y1c: string; y1v: string; y2c: string; y2v: string }
interface View { n: string; q: Query }
const VKEY = 'enerops-analysis-views';
function viewsRead(): View[] {
  try { const v = JSON.parse(localStorage.getItem(VKEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function viewsWrite(v: View[]) { try { localStorage.setItem(VKEY, JSON.stringify(v)); } catch { /* lasts the tab */ } }
const same = (a: Query, b: Query) => a.y1c === b.y1c && a.y1v === b.y1v && a.y2c === b.y2c && a.y2v === b.y2v &&
  a.dev.length === b.dev.length && a.dev.every((d, i) => d === b.dev[i]);
const say = (q: Query) => q.dev.length + (q.dev.length === 1 ? ' device' : ' devices') + ' · ' + (q.y2c === NONE ? q.y1v : q.y1v + ' / ' + q.y2v);

function DevicePick({ devices, sel, onSel }: { devices: Device[]; sel: string[]; onSel: (v: string[]) => void }) {
  const [open, setOpen] = usePanelOpen();
  const order = (l: string[]) => devices.map(d => d.id).filter(id => l.includes(id));
  const name = (id: string) => devices.find(d => d.id === id)?.name ?? id;
  return (
    <div className={'msel' + (open ? ' open' : '')} id="m-dev">
      <button type="button" className="mbtn" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(!open); }}>
        <span className={'mlab' + (sel.length ? '' : ' any')}>{!sel.length ? 'Select devices' : sel.length === 1 ? name(sel[0]) : sel.length + ' selected'}</span>
      </button>
      {open && (
        <div className="colpanel mpanel" onClick={e => e.stopPropagation()}>
          <div className="colhead">Devices · plotted in fleet order</div>
          {devices.map(d => {
            const on = sel.includes(d.id), i = sel.slice(0, PLOTCAP).indexOf(d.id);
            return (
              <label className="colrow" key={d.id}>
                <input type="checkbox" checked={on} onChange={e => onSel(order(e.target.checked ? [...sel, d.id] : sel.filter(x => x !== d.id)))} />
                <span className="swatch" style={{ background: i >= 0 ? SLOTS[i] : 'transparent' }} />{d.name}
                {on && i < 0 && <span className="noda">TABLE ONLY</span>}
              </label>
            );
          })}
          <div className="colfoot">
            <button type="button" onClick={() => onSel(devices.map(d => d.id))}>All</button>
            <button type="button" onClick={() => onSel([])}>None</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Analysis() {
  const { site, error: siteErr, reloadSites } = useSite();
  const toast = useToast();
  /* a closed historical window does not move while you read it: refresh starts Off */
  const [refresh, setRefresh] = useState<Refresh>('off');
  const siteId = site?.id ?? null;

  const devices = useApi(siteId ? s => api.getSiteDevices(siteId, { signal: s }) : null, [siteId]);
  const fleet = devices.data ?? [];
  const kindOf = useCallback((id: string) => fleet.find(d => d.id === id)?.kind ?? id.slice(0, 3), [fleet]);
  const rep = useCallback((id: string, tag: string) => !!tag && reports(kindOf(id), tag), [kindOf]);
  const nameOf = (id: string) => fleet.find(d => d.id === id)?.name ?? id;

  /* -------- the query -------- */
  const [sel, setSel] = useState<string[] | null>(null);
  const [y1c, setY1c] = useState('AC Power'), [y1v, setY1v] = useState('P_AC');
  const [y2c, setY2c] = useState('Irradiance'), [y2v, setY2v] = useState('POA');
  /* The page opens on the canonical solar question: two inverters' power against
     the irradiance that drove it. The weather station is in the selection
     because it is the device that reports POA - without it the second axis
     would open empty, and read as a broken control. */
  const SEL = useMemo(() => sel ?? [
    ...fleet.filter(d => d.kind === 'INV' && d.status !== 'down').slice(0, 2).map(d => d.id),
    ...fleet.filter(d => d.kind === 'WMS').slice(0, 1).map(d => d.id),
  ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => fleet.findIndex(d => d.id === a) - fleet.findIndex(d => d.id === b)), [sel, fleet]);
  useEffect(() => { setSel(null); }, [siteId]);
  const y2 = y2c === NONE ? '' : y2v;

  const today = new Date(), yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const [fd, setFd] = useState(isoDay(yest)), [ft, setFt] = useState('00:00');
  const [td, setTd] = useState(isoDay(today)), [tt, setTt] = useState('00:00');
  const from = Date.parse(fd + 'T' + ft + ':00'), to = Date.parse(td + 'T' + tt + ':00');
  const win = Number.isFinite(from) && Number.isFinite(to) && to > from ? { from, to } : null;
  const interval = win ? intervalFor(win.to - win.from) : '5m';

  const d1 = SEL.filter(id => rep(id, y1v)), d2 = y2 ? SEL.filter(id => rep(id, y2)) : [];
  const every = refreshMs(refresh);
  const s1 = useApi(siteId && win && d1.length
    ? s => api.getTimeSeries(siteId, { devices: d1, param: y1v, from: new Date(win.from).toISOString(), to: new Date(win.to).toISOString(), interval }, { signal: s })
    : null, [siteId, d1.join(','), y1v, win?.from, win?.to, interval], every);
  const s2 = useApi(siteId && win && d2.length
    ? s => api.getTimeSeries(siteId, { devices: d2, param: y2, from: new Date(win.from).toISOString(), to: new Date(win.to).toISOString(), interval }, { signal: s })
    : null, [siteId, d2.join(','), y2, win?.from, win?.to, interval], every);

  /* the rows the query resolves to: both series merged on their timestamps */
  const rows: ARow[] = useMemo(() => {
    const byT = new Map<number, ARow>();
    const put = (ts: TimeSeries | null, which: 1 | 2) => {
      if (!ts) return;
      ts.times.forEach((iso, i) => {
        const t = Date.parse(iso); if (!Number.isFinite(t)) return;
        let r = byT.get(t); if (!r) { r = { t, v1: {}, v2: {} }; byT.set(t, r); }
        for (const s of ts.series) (which === 1 ? r.v1 : r.v2)[s.deviceId] = s.values[i] ?? null;
      });
    };
    put(d1.length ? s1.data : null, 1); put(d2.length ? s2.data : null, 2);
    return [...byT.values()].sort((a, b) => a.t - b.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s1.data, s2.data, d1.join(','), d2.join(',')]);
  const loading = (d1.length > 0 && !s1.data && !s1.error) || (d2.length > 0 && !s2.data && !s2.error);
  const failed = s1.error || s2.error;

  /* -------- legend toggles, colour by plotted slot -------- */
  const [off, setOff] = useState<Record<string, boolean>>({});
  const plotted = SEL.slice(0, PLOTCAP);
  const colorOf = (id: string) => SLOTS[plotted.indexOf(id)] || 'var(--dim)';
  const lines: ALine[] = [];
  for (const id of plotted) for (const which of [1, 2] as const) {
    const tag = which === 1 ? y1v : y2;
    if (!tag || !rep(id, tag) || off[id + '|' + which]) continue;
    lines.push({ id, name: nameOf(id), which, color: colorOf(id), tag, unit: unitOf(tag) });
  }

  /* -------- the chart keeps its proportions -------- */
  const card = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 1000, h: 300 });
  const fit = useCallback(() => {
    const c = card.current; if (!c) return;
    const w = Math.max(320, Math.round(c.clientWidth - 20)), h = Math.round(Math.min(380, Math.max(230, w * 0.21)));
    setSz(s => (s.w === w && s.h === h ? s : { w, h }));
  }, []);
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    if (card.current) ro.observe(card.current);
    return () => ro.disconnect();
  }, [fit, site]);

  /* -------- the table: device names across the top, each parameter it reports beneath -------- */
  const [cols, setCols] = useState<string[] | null>(null);
  const COLS = useMemo(() => (cols ?? SEL).filter(id => SEL.includes(id)), [cols, SEL]);
  useEffect(() => { setCols(c => (c ? [...c.filter(id => SEL.includes(id)), ...SEL.filter(id => !c.includes(id))] : c)); }, [SEL.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = COLS.map(id => ({ id, cells: [...(rep(id, y1v) ? [{ which: 1 as const, p: y1v }] : []), ...(y2 && rep(id, y2) ? [{ which: 2 as const, p: y2 }] : [])] }))
    .filter(d => d.cells.length);
  const [per, setPer] = useState(100), [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows, per]);
  const fromRow = page * per, slice = rows.slice(fromRow, fromRow + per);
  const tableRef = useRef<HTMLTableElement>(null);
  const [colOpen, setColOpen] = useState(false);
  const colpick = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colOpen) return;
    const click = (e: MouseEvent) => { if (colpick.current && !colpick.current.contains(e.target as Node)) setColOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setColOpen(false); };
    document.addEventListener('click', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key); };
  }, [colOpen]);

  /* -------- saved views -------- */
  const [views, setViews] = useState<View[]>(viewsRead);
  const [cur, setCur] = useState('');
  const [vwOpen, setVwOpen] = useState(false);
  const [vwName, setVwName] = useState('');
  const [vwErr, setVwErr] = useState('');
  const snap: Query = { dev: SEL.slice(), y1c, y1v, y2c, y2v };
  const curView = views.find(v => v.n === cur);
  const dirty = !!curView && !same(curView.q, snap);
  useEffect(() => {
    if (!vwOpen) return;
    const close = () => setVwOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setVwOpen(false); };
    document.addEventListener('click', close); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', key); };
  }, [vwOpen]);
  const applyView = (v: View) => {
    setSel(v.q.dev.slice()); setY1c(v.q.y1c); setY1v(v.q.y1v); setY2c(v.q.y2c); setY2v(v.q.y2v);
    setCur(v.n); setVwOpen(false); toast('Opened “' + v.n + '”');
  };
  const saveView = () => {
    const n = vwName.trim();
    if (!n) { setVwErr('A view needs a name.'); return; }
    const had = views.find(v => v.n === n);
    /* saving over a name REPLACES it - two views called the same thing is a list you cannot read */
    const next = (had ? views.map(v => (v.n === n ? { n, q: snap } : v)) : [...views, { n, q: snap }])
      .sort((a, b) => (a.n.toLowerCase() < b.n.toLowerCase() ? -1 : 1));
    setViews(next); viewsWrite(next); setCur(n); setVwOpen(false);
    toast(had ? '“' + n + '” updated' : '“' + n + '” saved');
  };
  const delView = (v: View) => {
    const next = views.filter(x => x !== v);
    setViews(next); viewsWrite(next);
    if (cur === v.n) setCur('');      /* the bar is LEFT WHERE IT IS */
    toast('“' + v.n + '” deleted');
  };

  if (!site) {
    return (
      <div className="pg-analysis">
        <TopBar refresh={refresh} onRefresh={setRefresh} />
        <div className="wrap"><div className="card">
          {siteErr ? <Failed error={siteErr} what="your sites" onRetry={reloadSites} /> : <Waiting what="Loading sites" />}
        </div></div>
      </div>
    );
  }

  const note = !win ? 'Set a window: the end must be after the start.'
    : devices.error ? 'Could not load this site\'s devices.'
    : !SEL.length ? 'Pick one or more devices to plot.'
    : failed ? 'Could not load the readings: ' + failed.message
    : loading ? 'Loading readings…'
    : !rows.length ? 'No readings in this window.'
    : !lines.length ? 'None of the selected devices reports ' + [y1v, y2].filter(Boolean).join(' or ') + '.'
    : null;

  const blank = !plan.length || !rows.length;
  const exportCsv = () => {
    const devRow = ['', ...plan.flatMap(d => d.cells.map(() => nameOf(d.id)))];
    const varRow = ['Time Stamp', ...plan.flatMap(d => d.cells.map(c => labelWithUnit(c.p)))];
    const body = rows.map(r => [stampMs(r.t), ...plan.flatMap(d => d.cells.map(c => { const v = (c.which === 1 ? r.v1 : r.v2)[d.id]; return v == null || !Number.isFinite(v) ? '' : fmtNum(v); }))]);
    downloadCsv('Analysis_' + fd + '_' + td + '.csv', [devRow, varRow, ...body]);
    toast('Exported ' + body.length + ' rows · ' + plan.length + ' device' + (plan.length === 1 ? '' : 's'));
  };

  const valOpts = (k: string) => tagsOf(k).map(t => ({ v: t, t, extra: unitOf(t) ? <span className="unit">{unitOf(t)}</span> : null }));

  return (
    <div className="pg-analysis">
      <TopBar refresh={refresh} onRefresh={setRefresh} />

      {/* ======================= FILTER BAR ======================= */}
      <div className="toprow">
        <div className="filters">
          {/* SAVED VIEWS: a view is the WHOLE query - devices, both categories,
              both values - and NOT the window: reopening one asks the same thing
              about a different day. */}
          <div className="field">
            <label>Profile</label>
            <div className={'vw' + (curView ? ' on' : '') + (vwOpen ? ' open' : '')} id="vw">
              <button className="vwbtn" id="vw-btn" type="button" aria-haspopup="true" aria-expanded={vwOpen}
                      onClick={e => { e.stopPropagation(); setVwOpen(!vwOpen); setVwName(cur); setVwErr(''); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3.8h11a1 1 0 0 1 1 1V20l-6.5-3.6L5.5 20V4.8a1 1 0 0 1 1-1z" /></svg>
                <span className={'t' + (curView ? '' : ' none')}>{curView ? curView.n : 'Unsaved view'}</span>
                {/* EDITED, said out loud: a view changed since it was opened is not that view any more */}
                {dirty && <span className="edit">EDITED</span>}
              </button>
              {vwOpen && (
                <div className="colpanel vwpanel" id="vw-panel" onClick={e => e.stopPropagation()}>
                  <div className="colhead">Saved views</div>
                  <div className="vwlist">
                    {!views.length ? <div className="vwnone">No saved views yet. Set the bar the way you want it, then name it below — it comes back with one click.</div>
                      : views.map(v => (
                        <div key={v.n} className={'vwrow' + (v.n === cur ? ' on' : '')} role="button" tabIndex={0}
                             onClick={() => applyView(v)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyView(v); } }}>
                          <span className="n">{v.n}</span><span className="q">{say(v.q)}</span>
                          <button className="vwx" type="button" title="Delete this view" aria-label={'Delete ' + v.n}
                                  onClick={e => { e.stopPropagation(); delView(v); }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 6.5h15M9.5 6.5V5a1.4 1.4 0 0 1 1.4-1.4h2.2A1.4 1.4 0 0 1 14.5 5v1.5" /><path d="M6.6 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.8-12.5" /></svg>
                          </button>
                        </div>
                      ))}
                  </div>
                  <div className="vwfoot">
                    <input type="text" maxLength={40} spellCheck={false} placeholder="Name this view" value={vwName}
                           onChange={e => setVwName(e.target.value)}
                           onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveView(); } }} />
                    <button type="button" onClick={saveView}>Save</button>
                  </div>
                  <div className="vwerr">{vwErr}</div>
                </div>
              )}
            </div>
          </div>

          {/* Device is the ONE control that takes several values: analysis is comparison */}
          <div className="field"><label>Device</label>
            <DevicePick devices={fleet} sel={SEL} onSel={v => setSel(v)} /></div>

          <div className="pair">
            <div className="field"><label><span className="axtag"><i className="solid" />Y1 category</span></label>
              <SingleSelect head="Y1 category" value={y1c} options={CATEGORIES.map(c => ({ v: c.k, t: c.k }))}
                            onChange={v => { setY1c(v); const t = tagsOf(v); const nv = t.includes(y1v) ? y1v : t[0]; setY1v(nv); toast('Y1 · ' + v + ' · ' + nv); }} /></div>
            <div className="field"><label>Y1 value</label>
              <SingleSelect head="Y1 value" value={y1v} options={valOpts(y1c)} onChange={v => { setY1v(v); toast('Y1 · ' + labelWithUnit(v)); }} /></div>
          </div>
          <div className="pair">
            {/* Y2 offers None first: a second scale you did not ask for is one you have to discount */}
            <div className="field"><label><span className="axtag"><i className="dash" />Y2 category</span></label>
              <SingleSelect head="Y2 category" value={y2c} options={[NONE, ...CATEGORIES.map(c => c.k)].map(k => ({ v: k, t: k }))}
                            onChange={v => {
                              setY2c(v);
                              if (v === NONE) { toast('Y2 off · one scale'); return; }
                              const t = tagsOf(v); const nv = t.includes(y2v) ? y2v : t[0]; setY2v(nv); toast('Y2 · ' + v + ' · ' + nv);
                            }} /></div>
            <div className="field"><label>Y2 value</label>
              {y2c === NONE
                ? <div className="msel"><button type="button" className="mbtn" disabled><span className="mlab any">{DASH}</span></button></div>
                : <SingleSelect head="Y2 value" value={y2v} options={valOpts(y2c)} onChange={v => { setY2v(v); toast('Y2 · ' + labelWithUnit(v)); }} />}
            </div>
          </div>

          <div className="field"><label>Start date time</label>
            <div className={'dt' + (win ? '' : ' bad')} id="dt-from">
              <DateInput id="f-from-d" aria-label="Start date" value={fd} onValue={setFd} />
              <TimePick value={ft} onValue={setFt} />
            </div>
          </div>
          <div className="field"><label>End date time</label>
            <div className={'dt' + (win ? '' : ' bad')} id="dt-to">
              <DateInput id="f-to-d" aria-label="End date" value={td} onValue={setTd} />
              <TimePick value={tt} onValue={setTt} />
            </div>
          </div>
          <div className="field"><label>&nbsp;</label><span className="dtwarn" id="dtwarn" hidden={!!win}>End must be after start</span></div>
        </div>
      </div>

      <div className="wrap">
        {/* ======================= ANALYSIS DATA ======================= */}
        <div className="card" ref={card}>
          <div className="chead">
            <div className="title">Analysis Data</div>
            <div className="legend" id="legend">
              {plotted.flatMap(id => ([1, 2] as const).map(which => {
                const p = which === 1 ? y1v : y2;
                /* a device is only paired with a parameter it actually reports */
                if (!p || !rep(id, p)) return null;
                const k = id + '|' + which;
                return (
                  <span key={k} className={'lg' + (off[k] ? ' off' : '')} onClick={() => setOff(o => ({ ...o, [k]: !o[k] }))}>
                    <i className={which === 1 ? 'solid' : 'dash'} style={{ borderTopColor: colorOf(id) }} />
                    <span className="n">{nameOf(id)}</span><span className="p">{p}</span>
                  </span>
                );
              }))}
              {SEL.length > PLOTCAP && (
                <span className="lg" style={{ cursor: 'default' }}
                      title="Colour cannot keep more than four series apart in one frame for a colour-blind reader. The rest are in the table below.">
                  <span className="p">+{SEL.length - PLOTCAP} more in table</span>
                </span>
              )}
            </div>
          </div>
          <AnalysisChart from={win?.from ?? 0} to={win?.to ?? 1} rows={rows} lines={lines} hasY2={!!y2}
                         y1Label={labelWithUnit(y1v)} y2Label={y2 ? labelWithUnit(y2) : ''}
                         width={sz.w} height={sz.h} note={note} />
        </div>

        {/* ======================= TABLE ======================= */}
        <div className="card">
          <div className="ttools">
            <div className="colpick" id="colpick" ref={colpick}>
              <button className="tbtn" id="colbtn" type="button" aria-expanded={colOpen} onClick={e => { e.stopPropagation(); setColOpen(!colOpen); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6.2 7.3v6l-3.6 1.8v-7.8L4 5z" /></svg>FILTER</button>
              {colOpen && (
                <div className="colpanel" id="colpanel">
                  <div className="colhead">Shown in the table and the export</div>
                  <label className="colrow locked"><input type="checkbox" checked disabled />Time Stamp<span className="req">REQUIRED</span></label>
                  <div className="coldiv" />
                  {SEL.length ? SEL.map(id => {
                    const has = rep(id, y1v) || (!!y2 && rep(id, y2));
                    return (
                      <label className="colrow" key={id}>
                        <input type="checkbox" checked={COLS.includes(id)} onChange={e => {
                          const next = e.target.checked ? [...COLS, id] : COLS.filter(x => x !== id);
                          setCols(SEL.filter(x => next.includes(x)));
                        }} />
                        <span className="swatch" style={{ background: colorOf(id) }} />{nameOf(id)}
                        {!has && <span className="noda">NO DATA</span>}
                      </label>
                    );
                  }) : <div className="colhead" style={{ padding: 8 }}>No devices selected in the bar above</div>}
                  <div className="colfoot">
                    <button type="button" onClick={() => setCols(SEL.slice())}>All</button>
                    <button type="button" onClick={() => setCols([])}>None</button>
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
                <tr className="grp">
                  <th className="ts" rowSpan={2} style={{ verticalAlign: 'bottom', borderBottom: '1px solid var(--line-soft)' }}>Time Stamp</th>
                  {blank ? [0, 1, 2].map(i => <th key={i} className="ph">Device Name</th>)
                    : plan.map(d => <th key={d.id} className="dev sep" colSpan={d.cells.length}>{nameOf(d.id)}</th>)}
                </tr>
                <tr>{blank ? [0, 1, 2].map(i => <th key={i} className="ph">Variable Name</th>)
                  : plan.flatMap(d => d.cells.map((c, i) => <th key={d.id + c.which} className={i ? undefined : 'sep'}>{labelWithUnit(c.p)}</th>))}</tr>
              </thead>
              <tbody>
                {blank ? (
                  <tr><td colSpan={4}>
                    {failed ? <Failed error={failed} what="readings" onRetry={() => { s1.reload(); s2.reload(); }} />
                      : loading ? <Waiting what="Loading readings" />
                      : <div className="empty-note tall">{!rows.length ? 'No data' : !COLS.length ? 'No columns selected'
                          : 'None of these devices reports ' + [y1v, y2].filter(Boolean).join(' or ')}</div>}
                  </td></tr>
                ) : slice.map(r => (
                  <tr key={r.t}>
                    <td className="ts">{stampMs(r.t)}</td>
                    {plan.flatMap(d => d.cells.map((c, i) => {
                      const v = (c.which === 1 ? r.v1 : r.v2)[d.id];
                      const nil = v == null || !Number.isFinite(v);
                      const cl = [i ? '' : 'sep', nil ? 'nil' : ''].filter(Boolean).join(' ');
                      return <td key={d.id + c.which} className={cl || undefined}>{nil ? DASH : fmtNum(v as number)}</td>;
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter per={per} onPer={setPer} from={fromRow} shown={blank ? 0 : slice.length} total={blank ? 0 : rows.length}
                       onPage={d => setPage(p => Math.max(0, p + d))} />
        </div>
      </div>
      <RowPopover tableRef={tableRef} />
    </div>
  );
}
