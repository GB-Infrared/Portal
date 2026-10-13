import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as api from '../api/portal';
import type { Alarm, Device, HomeKpiMetric, Reading, Severity } from '../api/types';
import { useSite } from '../auth/SiteContext';
import { PowerChart } from '../charts/PowerChart';
import { MonthBars } from '../charts/MonthBars';
import { niceSteps } from '../charts/util';
import { DateInput } from '../components/DateInput';
import { DataGate, NoSite } from '../components/DataState';
import { MonthPicker } from '../components/MonthPicker';
import { MultiSelect, SingleSelect } from '../components/Select';
import { TopBar, refreshMs, type Refresh } from '../components/TopBar';
import { useToast } from '../components/Toasts';
import { useApi } from '../hooks/useApi';
import { DASH, dayMonYear, dt24, fx, isoDay, time12, toDate } from '../lib/format';
import '../styles/pages/home.css';

const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)',
  'var(--s7)', 'var(--s8)', 'var(--s9)', 'var(--s10)', 'var(--s11)', 'var(--s12)'];
const SEVLBL: Record<Severity, string> = { critical: 'CRITICAL', alarm: 'ALARM', warn: 'WARNING', event: 'EVENT' };
const SEVNICE: Record<Severity, string> = { critical: 'Critical', alarm: 'Alarm', warn: 'Warning', event: 'Event' };
const SEVRANK: Record<Severity, number> = { critical: 0, alarm: 1, warn: 2, event: 3 };
const DEVLBL = { ok: 'RUNNING', warn: 'LOW OUTPUT', down: 'OFFLINE' } as const;
const METRICS: { v: HomeKpiMetric; t: string }[] = [{ v: 'CUF', t: 'CUF' }, { v: 'PR', t: 'PR' }, { v: 'Availability', t: 'Availability' }];

const ClockGlyph = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
       strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Last updated">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" />
  </svg>
);

function Stamp({ at }: { at: string | null }) {
  const d = toDate(at);
  return (
    <div className="stamp" title={d ? 'Last updated ' + dayMonYear(d) + ', ' + time12(d, true) : 'Last updated'}>
      <ClockGlyph /><span className="t">{d ? dayMonYear(d) + ', ' + time12(d) : DASH}</span>
    </div>
  );
}

function Kpi({ label, icon, value, unit, unitFirst, reading, children }: {
  label: string; icon: ReactNode; value: string; unit: string; unitFirst?: boolean; reading?: Reading; children?: ReactNode;
}) {
  return (
    <div className="kpi">
      <div className="lbl">{label}</div>
      <span className="ico">{icon}</span>
      <div className="val">
        {unitFirst ? <><span className="u" style={{ margin: '0 3px 0 0' }}>{unit}</span><span>{value}</span></>
          : <><span>{value}</span><span className="u">{unit}</span></>}
      </div>
      {children}
      {reading && <Stamp at={reading.updatedAt} />}
    </div>
  );
}

function KpiStrip({ siteId, refresh }: { siteId: string; refresh: number }) {
  const s = useApi(sig => api.getSiteSummary(siteId, { signal: sig }), [siteId], refresh);
  if (!s.data) {
    return (
      <div className="kpistrip">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <DataGate loading={s.loading} error={s.error} what="the site's readings" onRetry={s.reload} style={{ minHeight: 96 }} />
        </div>
      </div>
    );
  }
  const k = s.data;
  const cap = k.capacityKw;
  const pw = k.plantPowerKw.value;
  const pct = pw != null && cap ? pw / cap * 100 : null;
  const peakAt = toDate(k.peakPowerKw.at);

  let delta: { t: string; c: string } = { t: DASH, c: 'flat' };
  const y = k.energyYesterdaySameTimeKwh, e = k.energyTodayKwh.value;
  if (y != null && y > 0 && e != null) {
    const p = (e - y) / y * 100;
    delta = { t: (p >= 0 ? '+' : '') + p.toFixed(1) + '%', c: p > 0.5 ? 'up' : p < -0.5 ? 'down' : 'flat' };
  }
  const cur = k.currency || '₹';

  return (
    <div className="kpistrip">
      <div className="kpi hero">
        <div className="lbl">Plant power <span className="livechip"><span className="ldot" />LIVE</span></div>
        <div className="val"><span>{fx(pw, 1)}</span><span className="u">kW</span></div>
        <div className="meterbar"><i style={{ width: (pct == null ? 0 : Math.min(100, pct)) + '%' }} /></div>
        <div className="sub warn">{pct == null ? DASH : pct.toFixed(0)}% of {cap ?? DASH} kW capacity</div>
        <Stamp at={k.plantPowerKw.updatedAt} />
      </div>
      <Kpi label="Peak power today" value={fx(k.peakPowerKw.value, 1)} unit="kW"
           icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17.6 9 11l3.6 3.6L21 6" /><path d="M15.6 6H21v5.4" /></svg>}>
        <div className="sub">at <b>{peakAt ? time12(peakAt) : DASH}</b></div>
      </Kpi>
      <Kpi label="Energy today" value={fx(k.energyTodayKwh.value, 2)} unit="kWh" reading={k.energyTodayKwh}
           icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 3v3M16 3v3" /></svg>}>
        <div className="sub"><span className={'delta ' + delta.c}>{delta.t}</span> vs yesterday</div>
      </Kpi>
      <Kpi label="Plant energy" value={fx(k.plantEnergyKwh.value, 2)} unit="kWh" reading={k.plantEnergyKwh}
           icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.5H11L9.8 22 19 10h-6.6L13 2Z" /></svg>} />
      <Kpi label="Performance ratio" value={fx(k.performanceRatioPct.value, 1)} unit="%" reading={k.performanceRatioPct}
           icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M4 17a8 8 0 1 1 16 0" /><path d="M12 17l4.2-4.6" /></svg>} />
      <Kpi label="Irradiance" value={fx(k.irradianceWm2.value, 0)} unit="W/m2" reading={k.irradianceWm2}
           icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></svg>} />
      <Kpi label="Revenue generated" value={fx(k.revenue.value, 2)} unit={cur} unitFirst reading={k.revenue} icon={cur} />
      <Kpi label="CO₂ avoided" value={fx(k.co2AvoidedKg.value, 2)} unit="kg" reading={k.co2AvoidedKg}
           icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M20 4c0 8-5 12-11 12H5c0-8 5-12 11-12h4Z" /><path d="M5 20c2.5-4 5.5-6.5 9-8" /></svg>} />
    </div>
  );
}

function AlarmBox({ alarms, onOpen }: { alarms: Alarm[] | null; onOpen: () => void }) {
  const c = (k: Severity) => (alarms ?? []).filter(a => a.severity === k).length;
  const cr = c('critical'), a = c('alarm'), w = c('warn'), e = c('event');
  const faults = cr + a + w, loud = cr + a;
  return (
    <div className={'alarmbox' + (loud ? ' hot' : '')} id="alarmbox" tabIndex={0} onMouseEnter={onOpen} onFocus={onOpen}>
      <div className="ab-head"><span className="t">Active alarms</span>
        <span className={'ab-n' + (loud ? ' hot' : '')}>{alarms ? faults : DASH}</span></div>
      <div className="ab-bars">
        {!alarms ? null : faults ? (
          <>
            {cr > 0 && <span className="ab-seg critical"><i />{cr} CRITICAL</span>}
            {a > 0 && <span className="ab-seg alarm"><i />{a} ALARM</span>}
            {w > 0 && <span className="ab-seg warn"><i />{w} WARNING</span>}
            {e > 0 && <span className="ab-seg event"><i />{e} EVENT</span>}
          </>
        ) : (
          <>
            <span className="ab-seg none"><i />ALL CLEAR</span>
            {e > 0 && <span className="ab-seg event"><i />{e} EVENT</span>}
          </>
        )}
      </div>
    </div>
  );
}

const ICO_OK = <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.2 12.4l2.6 2.6 5-5.4" /></svg>;
const ICO_FIL = <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5.5h17l-6.6 7.6v5.3l-3.8 2.1v-7.4Z" /></svg>;

function AlarmPanel({ alarms, error, loading, reload, siteName, maxHeight }: {
  alarms: Alarm[] | null; error: Error | null; loading: boolean; reload: () => void; siteName: string; maxHeight?: number;
}) {
  const [sev, setSev] = useState<string[]>([]);
  const all = alarms ?? [];
  const rows = all.filter(a => !sev.length || sev.includes(a.severity))
    .slice().sort((x, y) => SEVRANK[x.severity] - SEVRANK[y.severity]);
  const opts = (['critical', 'alarm', 'warn', 'event'] as Severity[]).map(v => {
    const n = all.filter(a => a.severity === v).length;
    return { v, t: SEVNICE[v], extra: <>{n ? <> <span style={{ color: 'var(--faint)', fontWeight: 700 }}>{n}</span></> : null}<i className={v} /></> };
  });

  let body: ReactNode;
  if (!alarms) body = <DataGate loading={loading} error={error} what="alarms" onRetry={reload} />;
  else if (rows.length) {
    body = rows.map(a => (
      <div className="arow" key={a.id}>
        <span className={'sev ' + a.severity} />
        <span className="amid"><span className="msg">{a.text}</span>
          <span className="meta"><b>{a.deviceName}</b> · {a.category ?? 'device'} · {dt24(toDate(a.receivedAt))}</span></span>
        <span className={'atag ' + a.severity}>{SEVLBL[a.severity]}</span>
      </div>
    ));
  } else if (!sev.length) {
    body = <div className="anone ok">{ICO_OK}<span className="t">All clear</span><span className="s">Nothing is open on {siteName} right now.</span></div>;
  } else {
    const n = all.length;
    body = (
      <div className="anone">{ICO_FIL}
        <span className="t">No {sev.map(k => SEVNICE[k as Severity]).join(' or ').toLowerCase()} alarms</span>
        <span className="s">{n ? n + (n === 1 ? ' alarm is' : ' alarms are') + ' open at other severities.' : 'Nothing is open on this plant right now.'}</span>
        {n > 0 && <button className="clr" type="button" onClick={() => setSev([])}>Show all severities</button>}
      </div>
    );
  }
  return (
    <aside className="card apanel" id="apanel" style={maxHeight ? { maxHeight } : undefined}>
      <div className="chead">
        <div className="title">Active alarms</div>
        <div className="tools">
          <MultiSelect variant="m" head="Severity" any="All severities" value={sev} options={opts}
                       onChange={v => setSev(v)} />
        </div>
      </div>
      <div className="alist" id="alist">{body}</div>
    </aside>
  );
}

function FleetCard({ d, color, sel, mute, cap, onClick }: {
  d: Device; color: string; sel: boolean; mute: boolean; cap: number | null; onClick: () => void;
}) {
  const on = d.status !== 'down' && d.powerKw != null;
  const rated = d.ratedKw ?? cap;
  const w = on && rated ? Math.min(100, (d.powerKw as number) / rated * 100) : 0;
  return (
    <button type="button" className={'dev' + (sel ? ' sel' : '') + (mute ? ' mute' : '')}
            style={{ ['--ring' as string]: color }} aria-pressed={sel} onClick={onClick}
            title={(sel ? 'Remove ' : 'Add ') + d.name + (sel ? ' from the chart' : ' to the chart')}>
      <span className="dev-top"><span className={'dev-dot ' + d.status} />
        <span className="dev-id">{d.name}</span>
        <span className={'dev-st ' + d.status}>{DEVLBL[d.status]}</span></span>
      <span className="dev-line">
        <span className={'dev-val' + (on ? '' : ' dim')}><span>{on ? fx(d.powerKw, 1) : DASH}</span><span className="u">kW</span></span>
        {on && d.energyTodayKwh != null && <span className="dev-meta"><span>{fx(d.energyTodayKwh, 1)}</span> kWh today</span>}
      </span>
      <span className="meterbar"><i className={d.status === 'warn' ? 'amber' : undefined} style={{ width: w.toFixed(1) + '%' }} /></span>
    </button>
  );
}

type Size = { w: number; h: number };

export default function Home() {
  const { site, error: siteErr, loading: siteLoading, reloadSites } = useSite();
  const toast = useToast();
  const [refresh, setRefresh] = useState<Refresh>('300');
  const every = refreshMs(refresh);
  const siteId = site?.id ?? null;

  const today = isoDay(new Date());
  const [day, setDay] = useState(today);
  const now = new Date();
  const [enYM, setEnYM] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [kpYM, setKpYM] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [metric, setMetric] = useState<HomeKpiMetric>('CUF');

  const devices = useApi(siteId ? sig => api.getSiteDevices(siteId, { signal: sig }) : null, [siteId], every);
  const alarms = useApi(siteId ? sig => api.getAlarms(siteId, { status: 'active' }, { signal: sig }) : null, [siteId], every);
  const power = useApi(siteId ? sig => api.getDayPower(siteId, day, { signal: sig }) : null, [siteId, day], day === today ? every : 0);
  const energy = useApi(siteId ? sig => api.getDailyEnergy(siteId, enYM.y, enYM.m + 1, { signal: sig }) : null, [siteId, enYM.y, enYM.m]);
  const kpi = useApi(siteId ? sig => api.getDailyKpi(siteId, metric, kpYM.y, kpYM.m + 1, { signal: sig }) : null, [siteId, metric, kpYM.y, kpYM.m]);

  const inverters = useMemo(() => (devices.data ?? []).filter(d => d.kind === 'INV'), [devices.data]);
  const [pwSel, setPwSel] = useState<string[]>([]);
  const [pwOff, setPwOff] = useState<Record<string, boolean>>({});
  useEffect(() => { setPwSel([]); setPwOff({}); }, [siteId]);
  const colorOf = useCallback((id: string) => {
    const i = inverters.findIndex(d => d.id === id);
    const d = inverters[i];
    return !d || d.status === 'down' ? 'var(--dim)' : SERIES[Math.max(0, i) % SERIES.length];
  }, [inverters]);
  const warnIds = useMemo(() => new Set(inverters.filter(d => d.status === 'warn').map(d => d.id)), [inverters]);
  const devFocus = (id: string) => {
    const next = pwSel.includes(id) ? pwSel.filter(x => x !== id) : [...pwSel, id];
    const order = inverters.map(d => d.id);
    next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    setPwSel(next);
    setPwOff(o => ({ power: o.power, irradiance: o.irradiance }));
    toast(!next.length ? 'Plant total' : next.length === 1 ? next[0] + ' vs irradiance' : next.length + ' inverters vs irradiance');
  };
  const clearFleet = () => { setPwSel([]); setPwOff(o => ({ power: o.power, irradiance: o.irradiance })); toast('Plant total'); };
  const pwToggle = (k: string) => setPwOff(o => ({ ...o, [k]: !o[k] }));
  const [cufOff, setCufOff] = useState<Record<string, boolean>>({});

  const [apOpen, setApOpen] = useState(false);
  const closeT = useRef(0);
  const openAlarms = () => { clearTimeout(closeT.current); setApOpen(true); };
  useEffect(() => {
    if (!apOpen) return;
    const over = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest && (t.closest('#alarmbox') || t.closest('#apanel'))) clearTimeout(closeT.current);
      else { clearTimeout(closeT.current); closeT.current = window.setTimeout(() => setApOpen(false), 150); }
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setApOpen(false); };
    document.addEventListener('mouseover', over);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('keydown', key); };
  }, [apOpen]);

  const gmRef = useRef<HTMLDivElement>(null), mcRef = useRef<HTMLElement>(null), pageRef = useRef<HTMLDivElement>(null);
  const pwCard = useRef<HTMLDivElement>(null), enCard = useRef<HTMLDivElement>(null), cufCard = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const [sz, setSz] = useState<{ pw: Size; en: Size; cuf: Size }>({ pw: { w: 1000, h: 300 }, en: { w: 600, h: 260 }, cuf: { w: 600, h: 260 } });
  const szRef = useRef(sz); szRef.current = sz;
  const apRef = useRef(apOpen); apRef.current = apOpen;
  const [apMax, setApMax] = useState<number | undefined>();

  const fit = useCallback(() => {
    const gm = gmRef.current, mc = mcRef.current, page = pageRef.current;
    const pc = pwCard.current, ec = enCard.current, cc = cufCard.current;
    if (!gm || !mc || !page || !pc || !ec || !cc) return;
    const cur = szRef.current;
    const wOf = (c: HTMLElement) => Math.max(280, Math.round(c.clientWidth - 20));
    let line = cur.pw.h, month = cur.en.h;
    if (!apRef.current) {
      const top = gm.getBoundingClientRect().top + window.scrollY;
      const cg = parseFloat(getComputedStyle(mc).rowGap) || 14;
      const padBottom = parseFloat(getComputedStyle(page).paddingBottom) || 16;
      const lineChrome = pc.offsetHeight - cur.pw.h, monthChrome = ec.offsetHeight - cur.en.h;
      const budget = document.documentElement.clientHeight - top - padBottom - cg - lineChrome - monthChrome;
      if (budget > 0) {
        line = Math.floor(Math.min(320, Math.max(150, budget * 0.52)));
        month = Math.floor(Math.min(430, Math.max(140, budget - line)));
        if (month < 120) { line = Math.max(150, line - (120 - month)); month = 120; }
      }
    }
    const next = { pw: { w: wOf(pc), h: line }, en: { w: wOf(ec), h: month }, cuf: { w: wOf(cc), h: month } };
    const same = (a: Size, b: Size) => a.w === b.w && a.h === b.h;
    if (!same(next.pw, cur.pw) || !same(next.en, cur.en) || !same(next.cuf, cur.cuf)) setSz(next);
    const rail = railRef.current;
    if (rail) {
      const kids = [...mc.children] as HTMLElement[];
      const h = kids.reduce((t, c) => t + c.getBoundingClientRect().height, 0) + colGap(mc) * Math.max(0, kids.length - 1);
      if (h > 0) rail.style.maxHeight = Math.round(h) + 'px';
    }
  }, []);

  useLayoutEffect(() => { fit(); });
  useEffect(() => {
    let raf = 0;
    const refit = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
    const ro = new ResizeObserver(refit);
    [pwCard.current, enCard.current, cufCard.current, mcRef.current].forEach(el => el && ro.observe(el));
    window.addEventListener('resize', refit);
    return () => { ro.disconnect(); window.removeEventListener('resize', refit); cancelAnimationFrame(raf); };
  }, [fit]);
  useEffect(() => {
    if (apOpen && pwCard.current) setApMax(pwCard.current.offsetHeight);
  }, [apOpen]);

  if (!site) {
    return (
      <div className="pg-home">
        <TopBar refresh={refresh} onRefresh={setRefresh} />
        <div className="page"><div className="card">
          <NoSite loading={siteLoading} error={siteErr} onRetry={reloadSites} />
        </div></div>
      </div>
    );
  }

  const invName = (id: string) => inverters.find(d => d.id === id)?.name ?? id;
  const title = (!pwSel.length ? 'Plant' : pwSel.length === 1 ? invName(pwSel[0]) : 'Inverter') + ' Power vs Irradiance';
  const chip = (key: string, color: string, label: string) => (
    <span key={key} className={'lg' + (pwOff[key] ? ' off' : '')} onClick={() => pwToggle(key)} title="Click to hide or show">
      <i style={{ background: color }} /><span className="n">{label}</span>
    </span>
  );

  const enVals = energy.data ? daysArr(energy.data.days.map(d => [d.day, d.kwh]), enYM) : null;
  const enScale = niceSteps(Math.max(1, ...(enVals ?? []).map(v => v ?? 0)), 4);
  const kpAct = kpi.data ? daysArr(kpi.data.days.map(d => [d.day, d.actual]), kpYM) : null;
  const kpSim = kpi.data ? daysArr(kpi.data.days.map(d => [d.day, d.simulated]), kpYM) : null;
  const kpSeries = kpi.data ? [
    { key: 'actual', name: 'Actual', color: 'var(--green)', values: kpAct! },
    { key: 'simulated', name: 'Simulated', color: 'var(--blue)', values: kpSim! },
  ].filter(s => !cufOff[s.key]) : [];
  const kpScale = niceSteps(Math.max(1, ...kpSeries.flatMap(s => s.values.map(v => v ?? 0))), 5);
  const todayD = new Date();
  const todayIn = (ym: { y: number; m: number }) => (ym.y === todayD.getFullYear() && ym.m === todayD.getMonth() ? todayD.getDate() : null);

  const chartBox = (s: Size, el: ReactNode) => <div className="chartwrap" style={{ height: s.h + 18 }}>{el}</div>;

  return (
    <div className="pg-home">
      <TopBar refresh={refresh} onRefresh={setRefresh} />
      <div className="page" ref={pageRef}>
        <KpiStrip siteId={site.id} refresh={every} />

        <div className="shell">
          <aside className="rail" ref={railRef}>
            <AlarmBox alarms={alarms.data} onOpen={openAlarms} />
            <div className="fleetstrip" id="fleet">
              {devices.data ? inverters.map(d => (
                <FleetCard key={d.id} d={d} color={colorOf(d.id)} sel={pwSel.includes(d.id)}
                           mute={pwSel.length > 0 && !pwSel.includes(d.id)}
                           cap={site.acCapacityKw && inverters.length ? site.acCapacityKw / inverters.length : null}
                           onClick={() => devFocus(d.id)} />
              )) : <DataGate loading={devices.loading} error={devices.error} what="devices" onRetry={devices.reload} />}
            </div>
          </aside>

          <main className="maincol" ref={mcRef}>
            <div className="g-main" id="g-main" ref={gmRef}>
              {apOpen && <AlarmPanel alarms={alarms.data} error={alarms.error} loading={alarms.loading} reload={alarms.reload}
                                     siteName={site.name} maxHeight={apMax} />}
              <div className="card" ref={pwCard}>
                <div className="chead">
                  <div className="title" id="pw-title-t">{title}</div>
                  {pwSel.length > 0 && (
                    <button className="backchip" id="pw-back" type="button" onClick={clearFleet} title="Back to the plant total">
                      <svg className="bk" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 6l-6 6 6 6" /></svg>
                      Plant total
                    </button>
                  )}
                  <div className="legend">
                    {!pwSel.length ? [chip('power', 'var(--green)', 'Power'), chip('irradiance', 'var(--amber)', 'Irradiance')]
                      : [...pwSel.map(id => chip(id, colorOf(id), invName(id))), chip('irradiance', 'var(--amber)', 'Irradiance')]}
                  </div>
                  <div className="tools">
                    <label className="field">
                      <span className="fl">Day</span>
                      <DateInput id="pw-date" value={day} max={today} onValue={setDay} />
                    </label>
                  </div>
                </div>
                {power.data
                  ? <PowerChart data={power.data} width={sz.pw.w} height={sz.pw.h} selected={pwSel} off={pwOff}
                                colorOf={colorOf} warnIds={warnIds} live={day === today} />
                  : chartBox(sz.pw, <DataGate loading={power.loading} error={power.error} what="the day's power" onRetry={power.reload} style={{ height: '100%' }} />)}
              </div>
            </div>

            <div className="g-half">
              <div className="card" ref={enCard}>
                <div className="chead">
                  <div className="title">Plant Energy Generation</div>
                  <div className="tools">
                    <MonthPicker id="en-pick" year={enYM.y} month={enYM.m} onPick={(y, m) => setEnYM({ y, m })} />
                  </div>
                </div>
                {enVals
                  ? <MonthBars idp="en" year={enYM.y} month={enYM.m + 1} width={sz.en.w} height={sz.en.h}
                               series={[{ key: 'kwh', name: 'Energy', color: 'var(--green)', values: enVals }]}
                               yMax={enScale.max} yStep={enScale.step} yTitle="ENERGY · kWh"
                               unit={v => v.toFixed(0) + ' kWh'} today={todayIn(enYM)} />
                  : chartBox(sz.en, <DataGate loading={energy.loading} error={energy.error} what="the month's energy" onRetry={energy.reload} style={{ height: '100%' }} />)}
              </div>
              <div className="card" ref={cufCard}>
                <div className="chead">
                  <div className="title">Plant KPI</div>
                  <div className="legend compact" id="cuf-legend">
                    {[{ k: 'actual', c: 'var(--green)', n: 'Actual' }, { k: 'simulated', c: 'var(--blue)', n: 'Simulated' }].map(x => (
                      <span key={x.k} className={'lg' + (cufOff[x.k] ? ' off' : '')} title="Click to hide or show"
                            onClick={() => setCufOff(o => ({ ...o, [x.k]: !o[x.k] }))}>
                        <i style={{ background: x.c }} /><span className="n">{x.n}</span>
                      </span>
                    ))}
                  </div>
                  <div className="tools">
                    <div className="field">
                      <span className="fl">Metric</span>
                      <SingleSelect variant="m" head="Metric" value={metric} options={METRICS} onChange={v => setMetric(v as HomeKpiMetric)} id="kpi-metric" />
                    </div>
                    <MonthPicker id="kpi-pick" year={kpYM.y} month={kpYM.m} onPick={(y, m) => setKpYM({ y, m })} />
                  </div>
                </div>
                {kpi.data
                  ? <MonthBars idp="cuf" year={kpYM.y} month={kpYM.m + 1} width={sz.cuf.w} height={sz.cuf.h}
                               series={kpSeries} yMax={kpScale.max} yStep={kpScale.step}
                               yDecimals={kpScale.step < 1 ? 1 : 0}
                               yTitle={metric.toUpperCase() + ' · %'} unit={v => v.toFixed(1) + '%'} today={todayIn(kpYM)} />
                  : chartBox(sz.cuf, <DataGate loading={kpi.loading} error={kpi.error} what={'the month\'s ' + metric} onRetry={kpi.reload} style={{ height: '100%' }} />)}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

const colGap = (el: HTMLElement) => parseFloat(getComputedStyle(el).rowGap) || 14;

function daysArr(pairs: [number, number | null][], ym: { y: number; m: number }): (number | null)[] {
  const n = new Date(ym.y, ym.m + 1, 0).getDate();
  const out: (number | null)[] = Array(n).fill(null);
  for (const [d, v] of pairs) if (d >= 1 && d <= n) out[d - 1] = v;
  return out;
}
