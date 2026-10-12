import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api/portal';
import type { Device } from '../api/types';
import { useSite } from '../auth/SiteContext';
import { MonitorChart, longDay, type Marker, type MSeries } from '../charts/MonitorChart';
import { DateInput } from '../components/DateInput';
import { DataGate, Failed, Waiting } from '../components/DataState';
import { RowPopover } from '../components/RowPopover';
import { SingleSelect } from '../components/Select';
import { TableFooter } from '../components/TableFooter';
import { TopBar, refreshMs, type Refresh } from '../components/TopBar';
import { useToast } from '../components/Toasts';
import { DEVICE_TYPES, labelWithUnit, paramOf, unitOf } from '../config/parameters';
import { useApi } from '../hooks/useApi';
import { downloadCsv } from '../lib/csv';
import { DASH, MONL, fx, isoDay, parseIsoDay, pad, time12, toDate } from '../lib/format';
import '../styles/pages/monitoring.css';

/* MONITORING - one device type, one data point, one day: the device rail on
   the left, the curve, and the readings behind it as a table.

   Ported from design-mockup/monitoring.html. No APPLY: every control re-reads
   on change, so the chart is always showing what the bar says it is. */

const SLOTS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
type Range = 'day' | 'week' | 'month';
const nf = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 2026-07-20 12:05:02 - a history row is a point in TIME, so the stamp carries
 *  its date, sortable, with a 24-hour clock that has no AM/PM to lose. */
const stamp = (d: Date | null) => d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
  pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) : DASH;

function cardState(d: Device): 'on' | 'warn' | 'off' {
  return d.status === 'down' ? 'off' : d.status === 'warn' ? 'warn' : 'on';
}

export default function Monitoring() {
  const { site, error: siteErr, reloadSites } = useSite();
  const toast = useToast();
  const [refresh, setRefresh] = useState<Refresh>('300');
  const every = refreshMs(refresh);
  const siteId = site?.id ?? null;

  /* -------- the filter bar -------- */
  const [dtype, setDtype] = useState(DEVICE_TYPES[0].label);
  const type = DEVICE_TYPES.find(t => t.label === dtype) ?? DEVICE_TYPES[0];
  const [dp, setDp] = useState(type.points[0]);
  /* the device type narrows the data point, so the pair is one decision - and
     the current answer is kept when the new list still offers it */
  useEffect(() => { if (!type.points.includes(dp)) setDp(type.points[0]); }, [type, dp]);
  const today = isoDay(new Date());
  const [day, setDay] = useState(today);
  const [range, setRange] = useState<Range>('day');

  /* -------- data -------- */
  const devices = useApi(siteId ? s => api.getSiteDevices(siteId, { signal: s }) : null, [siteId], every);
  const summary = useApi(siteId ? s => api.getSiteSummary(siteId, { signal: s }) : null, [siteId], every);
  const alarms = useApi(siteId ? s => api.getAlarms(siteId, { status: 'active' }, { signal: s }) : null, [siteId], every);
  const list = useMemo(() => (devices.data ?? []).filter(d => d.kind === type.kind), [devices.data, type.kind]);

  /* which devices are in the chart and the table - the FILTER panel's choice.
     It starts on the first two that are reporting, and starts again when the
     site or the device type changes, because the old choice names nothing here. */
  const [cols, setCols] = useState<string[] | null>(null);
  useEffect(() => { setCols(null); }, [siteId, type.kind]);
  const chosen = useMemo(() => cols ?? list.filter(d => d.status !== 'down').slice(0, 2).map(d => d.id), [cols, list]);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const colorOf = useCallback((id: string) => SLOTS[Math.max(0, chosen.indexOf(id)) % SLOTS.length], [chosen]);
  const nameOf = (id: string) => list.find(d => d.id === id)?.name ?? id;

  const dayDate = parseIsoDay(day) ?? new Date();
  const next = new Date(dayDate); next.setDate(next.getDate() + 1);
  const dayTs = useApi(siteId && chosen.length
    ? s => api.getTimeSeries(siteId, { devices: chosen, param: dp, from: dayDate.toISOString(), to: next.toISOString(), interval: '5m' }, { signal: s })
    : null, [siteId, chosen.join(','), dp, day], day === today ? every : 0);

  /* week: the seven days to the chosen one; month: the chosen day's month */
  const span = useMemo(() => {
    if (range === 'week') { const a = new Date(dayDate); a.setDate(a.getDate() - 6); return { from: a, to: next }; }
    const a = new Date(dayDate.getFullYear(), dayDate.getMonth(), 1), b = new Date(dayDate.getFullYear(), dayDate.getMonth() + 1, 1);
    return { from: a, to: b };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, day]);
  const peaks = useApi(siteId && chosen.length && range !== 'day'
    ? s => api.getTimeSeries(siteId, { devices: chosen, param: dp, from: span.from.toISOString(), to: span.to.toISOString(), interval: '1d', agg: 'max' }, { signal: s })
    : null, [siteId, chosen.join(','), dp, range, day]);

  /* -------- the device panel: hover a rail card -------- */
  const [cur, setCur] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const live = useApi(siteId && cur && panelOpen ? s => api.getDeviceLive(siteId, cur, { signal: s }) : null, [siteId, cur, panelOpen], every);
  const hideT = useRef(0);
  const openPanel = (id: string) => { clearTimeout(hideT.current); setCur(id); setPanelOpen(true); };
  useEffect(() => {
    if (!panelOpen) return;
    const over = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest && (t.closest('.dcard') || t.closest('#devpanel'))) clearTimeout(hideT.current);
      else { clearTimeout(hideT.current); hideT.current = window.setTimeout(() => setPanelOpen(false), 150); }
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelOpen(false); };
    document.addEventListener('mouseover', over); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('keydown', key); };
  }, [panelOpen]);

  /* -------- the chart is fitted to its card: height tracks the row's width
     inside a readable band, and the panel opening only narrows it -------- */
  const mainRef = useRef<HTMLDivElement>(null), chartCard = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 1000, h: 300 });
  const fit = useCallback(() => {
    const row = mainRef.current, card = chartCard.current; if (!row || !card) return;
    const w = Math.max(300, Math.round(card.clientWidth - 20));
    const h = Math.round(Math.min(430, Math.max(240, row.clientWidth * 0.235)));
    setSz(s => (s.w === w && s.h === h ? s : { w, h }));
  }, []);
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    if (chartCard.current) ro.observe(chartCard.current);
    if (mainRef.current) ro.observe(mainRef.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [fit, site]);
  const [panelMax, setPanelMax] = useState<number | undefined>();
  useEffect(() => { if (panelOpen && chartCard.current) setPanelMax(chartCard.current.offsetHeight); }, [panelOpen]);

  /* -------- the table -------- */
  const [per, setPer] = useState(100);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [siteId, dp, day, chosen.join(','), per]);
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

  if (!site) {
    return (
      <div className="pg-monitoring">
        <TopBar refresh={refresh} onRefresh={setRefresh} />
        <div className="shell"><div className="card" style={{ gridColumn: '1 / -1' }}>
          {siteErr ? <Failed error={siteErr} what="your sites" onRetry={reloadSites} /> : <Waiting what="Loading sites" />}
        </div></div>
      </div>
    );
  }

  /* warnings, by device: when a device's active warning started, for the
     deviation marker on its line and the amber cells after it */
  const warnSince = new Map<string, Date>();
  for (const a of alarms.data ?? []) {
    if (a.severity !== 'warn') continue;
    const at = toDate(a.receivedAt); if (!at) continue;
    const prev = warnSince.get(a.deviceId);
    if (!prev || at < prev) warnSince.set(a.deviceId, at);
  }

  /* -------- what the chart draws -------- */
  const shownIds = chosen.filter(id => !hidden[id]);
  const P = paramOf(dp), unit = unitOf(dp);
  let chartTimes: string[] = [], chartSeries: MSeries[] = [];
  const ts = range === 'day' ? dayTs.data : peaks.data;
  if (ts) {
    chartTimes = ts.times;
    chartSeries = shownIds.map(id => ({ id, name: nameOf(id), color: colorOf(id), values: ts.series.find(s => s.deviceId === id)?.values ?? ts.times.map(() => null) }));
  }
  const markers: Marker[] = range !== 'day' ? [] : shownIds.flatMap(id => {
    const at = warnSince.get(id);
    return at && isoDay(at) === day ? [{ id, at, title: nameOf(id) + ' deviation started ' + time12(at) }] : [];
  });
  const foot = range === 'day' ? longDay(dayDate)
    : range === 'week' ? 'WEEK TO ' + longDay(dayDate) + ' · DAILY PEAK'
    : MONL[dayDate.getMonth()].toUpperCase() + ' ' + dayDate.getFullYear() + ' · DAILY PEAK';
  const chartState = range === 'day' ? dayTs : peaks;

  /* -------- the rail -------- */
  const onDevs = list.filter(d => d.status !== 'down' && d.energyTotalKwh != null);
  const fleetAvg = onDevs.length ? onDevs.reduce((t, d) => t + (d.energyTotalKwh as number), 0) / onDevs.length : 0;
  const sum = summary.data;
  let eDelta: string | null = null;
  if (sum && sum.energyYesterdaySameTimeKwh && sum.energyTodayKwh.value != null) {
    const p = (sum.energyTodayKwh.value - sum.energyYesterdaySameTimeKwh) / sum.energyYesterdaySameTimeKwh * 100;
    eDelta = (p >= 0 ? '+' : '') + p.toFixed(1) + '% vs yesterday';
  }

  /* -------- the table: newest reading first, one column per chosen device -------- */
  const rowsAll = dayTs.data ? dayTs.data.times.map((t, i) => ({ t, i })).filter(r => dayTs.data!.series.some(s => s.values[r.i] != null)).reverse() : [];
  const from = page * per, slice = rowsAll.slice(from, from + per);
  const UNIT = labelWithUnit(dp);
  const valOf = (id: string, i: number) => dayTs.data?.series.find(s => s.deviceId === id)?.values[i] ?? null;
  const blank = !chosen.length || !rowsAll.length;

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [['', ...chosen.map(nameOf)], ['Time Stamp', ...chosen.map(() => UNIT)]];
    for (const r of rowsAll) rows.push([stamp(toDate(r.t)), ...chosen.map(id => { const v = valOf(id, r.i); return v == null ? '' : v.toFixed(2); })]);
    downloadCsv('monitoring_' + day + '.csv', rows);
    toast(chosen.length ? 'Exported ' + chosen.map(nameOf).join(', ') : 'Exported time stamps only');
  };

  const query = (what: string) => toast(site.name + ' · ' + what);
  const curDev = list.find(d => d.id === cur) ?? (devices.data ?? []).find(d => d.id === cur);
  const lv = live.data;
  const rated = lv?.ratedKw ?? curDev?.ratedKw ?? null;
  const pNow = lv?.values.P_AC ?? null;
  const gpct = pNow != null && rated ? Math.max(0, Math.min(1, pNow / rated)) : 0;
  const C = 2 * Math.PI * 30;
  const v2 = (k: string, d = 2) => fx(lv?.values[k] ?? null, d);

  return (
    <div className="pg-monitoring">
      <TopBar refresh={refresh} onRefresh={setRefresh} />

      {/* ======================= TOP ROW · title + filters, one line ======================= */}
      <div className="toprow">
        <div className="rail-head">
          <span className="t">Devices Live</span>
          <span className="live-chip"><span className="dot" style={{ width: 5, height: 5 }} />LIVE</span>
        </div>
        <div className="filters">
          <div className="field"><label>Device type</label>
            <SingleSelect head="Device type" value={dtype} options={DEVICE_TYPES.map(t => ({ v: t.label, t: t.label }))}
                          onChange={v => { setDtype(v); query(v + ' · ' + (DEVICE_TYPES.find(t => t.label === v)?.points.includes(dp) ? dp : DEVICE_TYPES.find(t => t.label === v)?.points[0])); }} />
          </div>
          <div className="field"><label>Data point</label>
            <SingleSelect head="Data point" title={P?.label} value={dp} options={type.points.map(p => ({ v: p, t: p }))}
                          onChange={v => { setDp(v); query(dtype + ' · ' + v); }} />
          </div>
          <div className="field"><label>Date</label>
            <DateInput id="dsel" value={day} max={today} onValue={v => { setDay(v); toast('Showing ' + v); }} />
          </div>
        </div>
      </div>

      <div className="shell">
        {/* ======================= LEFT RAIL · DEVICES ======================= */}
        <aside className="rail">
          <div className="strip" id="strip">
            {devices.data ? list.map(d => {
              const st = cardState(d);
              const plotted = chosen.includes(d.id) && !hidden[d.id];
              const pct = st !== 'off' && fleetAvg && d.energyTotalKwh != null ? (d.energyTotalKwh - fleetAvg) / fleetAvg * 100 : null;
              return (
                <div key={d.id} className={'dcard' + (st === 'off' ? ' is-off' : '') + (plotted ? ' plotted' : '') + (panelOpen && cur === d.id ? ' sel' : '')}
                     data-dev={d.id} style={plotted ? { ['--ring' as string]: colorOf(d.id) } : undefined}
                     onMouseEnter={() => openPanel(d.id)} onClick={() => openPanel(d.id)}>
                  <div className="head"><span className="name"><i className={'sdot ' + st} />{d.name}</span>
                    <span className={'status ' + st}>{st === 'off' ? 'OFFLINE' : st === 'warn' ? 'CHECK' : 'PRODUCING'}</span></div>
                  {st !== 'off' && (
                    <div className="foot">
                      <span className="etot">{d.energyTotalKwh == null ? DASH : nf(d.energyTotalKwh)}<span className="eu">kWh</span></span>
                      {pct != null && <span className={'edelta ' + (pct >= 0 ? 'up' : 'down')} title={'vs fleet average (' + nf(fleetAvg) + ' kWh)'}>{(pct >= 0 ? '+' : '') + pct.toFixed(1)}%</span>}
                    </div>
                  )}
                </div>
              );
            }) : <DataGate loading={devices.loading} error={devices.error} what="devices" onRetry={devices.reload} />}
            {devices.data && !list.length && <div className="empty-note tall">No {dtype.toLowerCase()} devices on this site</div>}
          </div>

          {/* plant readouts · live */}
          <div className="rail-kpis">
            <div className="kpi">
              <div className="lbl">Plant active power</div>
              <div className="val"><span>{fx(sum?.plantPowerKw.value ?? null, 1)}</span><span className="u">kW</span></div>
            </div>
            <div className="kpi">
              <div className="lbl">Energy today</div>
              <div className="val"><span>{sum?.energyTodayKwh.value != null ? nf(sum.energyTodayKwh.value) : DASH}</span><span className="u">kWh</span>
                {eDelta && <span className="sub">{eDelta}</span>}</div>
            </div>
          </div>
        </aside>

        {/* ======================= MAIN COLUMN ======================= */}
        <main className="maincol">
          <div className="main" ref={mainRef}>
            {panelOpen && cur && (
              <div className="card panel" id="devpanel" aria-labelledby="lp-name" style={panelMax ? { maxHeight: panelMax } : undefined}>
                <div className="chead">
                  <div className="devico">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.5H11L9.8 22 19 10h-6.6L13 2Z" /></svg>
                  </div>
                  <div className="pinfo">
                    <div className="nm"><span id="lp-name">{curDev?.name ?? cur}</span>
                      {(lv?.status ?? curDev?.status) === 'down'
                        ? <span className="pill offp">Offline</span> : <span className="pill on">Online</span>}</div>
                    <div className="mdl">{lv?.model ?? curDev?.model ?? DASH}</div>
                  </div>
                  <button className="iconbtn mclose" onClick={() => setPanelOpen(false)} title="Close (Esc)" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
                {!lv ? <DataGate loading={live.loading} error={live.error} what="this device's readings" onRetry={live.reload} /> : (
                  <div className="pbody">
                    <div className="gaugebox">
                      <svg width="66" height="66" viewBox="0 0 72 72">
                        <circle className="gtrack" cx="36" cy="36" r="30" fill="none" strokeWidth="7" />
                        <circle id="garc" cx="36" cy="36" r="30" fill="none" strokeWidth="7" strokeLinecap="round"
                                strokeDasharray="188.5" strokeDashoffset={(C * (1 - gpct)).toFixed(1)} transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset .6s' }} />
                        <text id="gpct" x="36" y="41" textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="ui-monospace,monospace">{pNow != null && rated ? Math.round(gpct * 100) + '%' : DASH}</text>
                      </svg>
                      <div className="txt">
                        <div className="big"><span>{v2('P_AC')}</span><span className="u">kW</span></div>
                        <div className="cap">P_AC · of {rated ?? DASH} kW rated</div>
                      </div>
                    </div>
                    <div className="ptitle">AC output</div>
                    <div className="pgrid">
                      <div className="pv"><div className="v"><span>{v2('S_AC')}</span><span className="u">kVA</span></div><div className="l">S_AC</div></div>
                      <div className="pv"><div className="v"><span>{v2('Q_AC')}</span><span className="u">kVAR</span></div><div className="l">Q_AC</div></div>
                      <div className="pv"><div className="v"><span>{v2('F_AC')}</span><span className="u">Hz</span></div><div className="l">F_AC</div></div>
                      <div className="pv"><div className="v"><span>{v2('COS_PHI', 3)}</span></div><div className="l">COS_PHI</div></div>
                    </div>
                    <div className="ptitle">AC current</div>
                    <div className="pgrid three">
                      {['I_AC1', 'I_AC2', 'I_AC3'].map(k => (
                        <div className="pv" key={k}><div className="v"><span>{v2(k)}</span><span className="u">A</span></div><div className="l">{k}</div></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="card" ref={chartCard}>
              <div className="chead">
                <div className="title">{P?.label ?? dp}</div>
                <div className="legend">
                  {/* the chips wear the SERIES tokens, the same ones the lines are drawn with */}
                  {chosen.map(id => {
                    const vals = dayTs.data?.series.find(s => s.deviceId === id)?.values ?? [];
                    let last: number | null = null; for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) { last = vals[i]; break; }
                    return (
                      <span key={id} className={'lg' + (hidden[id] ? ' off' : '')} onClick={() => setHidden(h => ({ ...h, [id]: !h[id] }))}>
                        <i style={{ background: colorOf(id) }} /><span className="n">{nameOf(id)}</span>
                        <span className="v">{last == null ? DASH : last.toFixed(1) + (unit ? ' ' + unit : '')}</span>
                      </span>
                    );
                  })}
                </div>
                <div className="tools">
                  <div className="seg">
                    {(['day', 'week', 'month'] as Range[]).map(r => (
                      <button key={r} className={range === r ? 'on' : undefined} onClick={() => {
                        setRange(r); toast(r === 'day' ? 'Day view' : r === 'week' ? 'Week view · daily peak' : 'Month view · daily peak');
                      }}>{r[0].toUpperCase() + r.slice(1)}</button>
                    ))}
                  </div>
                </div>
              </div>
              {!chosen.length || chartState.data
                ? <MonitorChart mode={range === 'day' ? 'day' : 'days'} times={chartTimes} series={chartSeries}
                                width={sz.w} height={sz.h} unit={unit} foot={foot} live={day === today} markers={markers}
                                yTitle={((P?.label ?? dp) + (unit ? ' · ' + unit : '')).toUpperCase()}
                                emptyNote={!chosen.length ? 'No devices selected - choose them in FILTER below' : undefined} />
                : <div className="chartwrap" style={{ height: sz.h + 18 }}>
                    <DataGate loading={chartState.loading} error={chartState.error} what="readings" onRetry={chartState.reload} style={{ height: '100%' }} />
                  </div>}
            </div>
          </div>

          {/* historical table */}
          <div className="card tcard">
            {/* The FILTER is the column picker: what is ticked here is what the
                table shows AND what the CSV carries. Time stamp is not optional -
                a reading without its time is not a reading. */}
            <div className="ttools">
              <div className="colpick" id="colpick" ref={colpick}>
                <button className="tbtn" id="colbtn" type="button" aria-expanded={colOpen} onClick={e => { e.stopPropagation(); setColOpen(!colOpen); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6.2 7.3v6l-3.6 1.8v-7.8L4 5z" /></svg>FILTER</button>
                {colOpen && (
                  <div className="colpanel" id="colpanel">
                    <div className="colhead">Shown in the table and the export</div>
                    <label className="colrow locked"><input type="checkbox" checked disabled />Time Stamp<span className="req">REQUIRED</span></label>
                    <div className="coldiv" />
                    {list.map(d => {
                      const on = chosen.includes(d.id), ok = d.status !== 'down';
                      return (
                        <label className="colrow" key={d.id}>
                          <input type="checkbox" checked={on} onChange={e => {
                            const next = e.target.checked ? [...chosen, d.id] : chosen.filter(x => x !== d.id);
                            setCols(list.map(x => x.id).filter(x => next.includes(x)));     /* the fleet's own order */
                          }} />
                          <span className="dot" style={{ background: ok ? (on ? colorOf(d.id) : 'var(--green)') : 'var(--red)' }} />{d.name}
                          {!ok && <span className="noda">NO DATA</span>}
                        </label>
                      );
                    })}
                    <div className="colfoot">
                      <button type="button" onClick={() => setCols(list.map(d => d.id))}>All</button>
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
                      : chosen.map(id => <th key={id}><span className="ringdot" style={{ ['--ring' as string]: colorOf(id) }} />{nameOf(id)}</th>)}
                  </tr>
                  <tr>{blank ? [0, 1, 2].map(i => <th key={i} className="ph">Variable Name</th>) : chosen.map(id => <th key={id}>{UNIT}</th>)}</tr>
                </thead>
                <tbody>
                  {blank ? (
                    <tr><td colSpan={4}>
                      {dayTs.error ? <Failed error={dayTs.error} what="readings" onRetry={dayTs.reload} />
                        : dayTs.loading ? <Waiting what="Loading readings" />
                        : <div className="empty-note tall">{!chosen.length ? 'No columns selected' : 'No data'}</div>}
                    </td></tr>
                  ) : slice.map(r => {
                    const at = toDate(r.t);
                    return (
                      <tr key={r.t}>
                        <td className="ts">{stamp(at)}</td>
                        {chosen.map(id => {
                          const v = valOf(id, r.i);
                          if (v == null) return <td key={id} className="ts">{DASH}</td>;
                          const since = warnSince.get(id);
                          const warn = !!(since && at && at >= since);
                          return <td key={id} className={warn ? 'warn' : undefined} title={warn ? 'Below expected — see alarms' : undefined}>{v.toFixed(2)}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TableFooter per={per} onPer={setPer} from={from} shown={slice.length} total={rowsAll.length}
                         onPage={d => setPage(p => Math.max(0, p + d))} />
          </div>
        </main>
      </div>
      <RowPopover tableRef={tableRef} />
    </div>
  );
}
