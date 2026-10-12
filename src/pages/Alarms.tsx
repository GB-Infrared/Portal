import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api/portal';
import type { Alarm, Severity } from '../api/types';
import { useSite } from '../auth/SiteContext';
import { DateInput } from '../components/DateInput';
import { Failed, Waiting } from '../components/DataState';
import { RowPopover } from '../components/RowPopover';
import { MultiSelect } from '../components/Select';
import { TableFooter } from '../components/TableFooter';
import { TopBar, refreshMs, type Refresh } from '../components/TopBar';
import { useToast } from '../components/Toasts';
import { useApi } from '../hooks/useApi';
import { downloadCsv } from '../lib/csv';
import { DASH, MON, WDAY, dt24, isoDay, parseIsoDay, toDate } from '../lib/format';
import '../styles/pages/alarms.css';

/* ALARMS - one site's log for a window of days.

   Ported from design-mockup/alarms.html. The window is the query: moving either
   date re-reads the log from the backend. Device, severity and status narrow
   what came back, in the browser, so the summary, the table and the export are
   always counted off the same rows. No APPLY step: the state the bar describes
   IS the state on screen. */

/* Received Time first: it is the alarm's identity in time. No plant column -
   the table is one site's log, and the site is named in the bar above. */
const COLDEF: { k: keyof typeof RAW; t: string }[] = [
  { k: 'recv', t: 'Received Time' },
  { k: 'res', t: 'Resolved Time' },
  { k: 'status', t: 'Status' },
  { k: 'text', t: 'Alarms Text' },
  { k: 'id', t: 'Alarm Id' },
  { k: 'sev', t: 'Severity' },
  { k: 'dev', t: 'Device Name' },
];
const SEVWORD = (s: Severity) => (s === 'warn' ? 'WARNING' : s.toUpperCase());
/* the export reads plain text where the table reads markup */
const RAW = {
  recv: (a: Alarm) => dt24(toDate(a.receivedAt)),
  res: (a: Alarm) => (a.resolvedAt ? dt24(toDate(a.resolvedAt)) : ''),
  status: (a: Alarm) => a.status.toUpperCase(),
  text: (a: Alarm) => a.text,
  id: (a: Alarm) => a.id,
  sev: (a: Alarm) => SEVWORD(a.severity),
  dev: (a: Alarm) => a.deviceName,
};

const SEV_OPTS = [{ v: 'alarm', t: 'Alarm' }, { v: 'event', t: 'Event' }, { v: 'warn', t: 'Warning' }, { v: 'critical', t: 'Critical' }];
const ST_OPTS = [{ v: 'active', t: 'Active' }, { v: 'resolved', t: 'Resolved' }];

/* the day an alarm arrived on, on the local clock its times are printed in */
const dayKey = (d: Date) => (d.getFullYear() * 100 + d.getMonth()) * 100 + d.getDate();

export default function Alarms() {
  const { site, error: siteErr, reloadSites } = useSite();
  const toast = useToast();
  const [refresh, setRefresh] = useState<Refresh>('300');
  const siteId = site?.id ?? null;

  /* the window: yesterday through today, by default. The end date is
     INCLUSIVE - a log asked for "the 26th to the 27th" contains the 27th. */
  const todayD = new Date();
  const yest = new Date(todayD); yest.setDate(yest.getDate() - 1);
  const [fromD, setFromD] = useState(isoDay(yest));
  const [toD, setToD] = useState(isoDay(todayD));
  const win = useMemo(() => {
    const a = parseIsoDay(fromD), b = parseIsoDay(toD);
    if (!a || !b) return null;
    const end = new Date(b); end.setDate(end.getDate() + 1);
    return end > a ? { from: a.toISOString(), to: end.toISOString() } : null;
  }, [fromD, toD]);

  /* an inverted window keeps the last good log rather than emptying the page */
  const lastWin = useRef(win);
  if (win) lastWin.current = win;
  const w = win ?? lastWin.current;

  const log = useApi(siteId && w ? s => api.getAlarms(siteId, { from: w.from, to: w.to }, { signal: s }) : null,
    [siteId, w?.from, w?.to], refreshMs(refresh));
  const devices = useApi(siteId ? s => api.getSiteDevices(siteId, { signal: s }) : null, [siteId]);

  const [fDev, setFDev] = useState<string[]>([]);
  const [fSev, setFSev] = useState<string[]>([]);
  const [fSt, setFSt] = useState<string[]>([]);
  useEffect(() => { setFDev(v => (v.length ? [] : v)); }, [siteId]);

  const rows = useMemo(() => {
    const all = log.data ?? [];
    return all.filter(a =>
      (!fDev.length || fDev.includes(a.deviceId)) &&
      (!fSev.length || fSev.includes(a.severity)) &&
      (!fSt.length || fSt.includes(a.status)))
      /* newest first, always - the headings do not sort, and the day groups only
         hold together while the rows stay in time order */
      .sort((x, y) => (toDate(y.receivedAt)?.getTime() ?? 0) - (toDate(x.receivedAt)?.getTime() ?? 0));
  }, [log.data, fDev, fSev, fSt]);

  const [per, setPer] = useState(100);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [fDev, fSev, fSt, w?.from, w?.to, per, siteId]);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const pg = Math.min(page, pages - 1);
  const from = pg * per, slice = rows.slice(from, from + per);

  /* One line, replaced in place - not a stack. Ticking four devices is ONE
     decision; the wait lets a run of ticks settle so the count that speaks is
     the count on screen. */
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => {
      const on = fDev.length + fSev.length + fSt.length;
      toast(on ? rows.length + ' alarms match' : 'Showing every alarm in the window');
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fDev, fSev, fSt]);

  const tableRef = useRef<HTMLTableElement>(null);

  if (!site) {
    return (
      <div className="pg-alarms">
        <TopBar refresh={refresh} onRefresh={setRefresh} />
        <div className="wrap"><div className="card">
          {siteErr ? <Failed error={siteErr} what="your sites" onRetry={reloadSites} /> : <Waiting what="Loading sites" />}
        </div></div>
      </div>
    );
  }

  /* summary: counted off the SAME filtered rows the table shows */
  const act = rows.filter(a => a.status === 'active').length;
  const of = (k: Severity) => rows.filter(a => a.severity === k).length;
  const alarm = of('alarm'), event = of('event'), warn = of('warn'), crit = of('critical');
  const tile = (k: string, v: number | string, cls: string) => (
    <div className={'sum ' + cls} key={k}><div className="k">{k}</div><div className="v">{v}</div></div>
  );
  const ready = !!log.data;

  /* each day's count over the whole filtered list, so a heading repeated after
     a page break still counts the whole day */
  const perDay = new Map<number, number>();
  for (const a of rows) { const d = toDate(a.receivedAt); if (d) perDay.set(dayKey(d), (perDay.get(dayKey(d)) ?? 0) + 1); }
  let lastDay: number | null = null;

  const exportCsv = () => {
    downloadCsv('Alarms_' + fromD + '.csv', [COLDEF.map(c => c.t), ...rows.map(a => COLDEF.map(c => RAW[c.k](a)))]);
    toast('Exported ' + rows.length + ' rows · ' + COLDEF.length + ' columns');
  };

  const devOpts = (devices.data ?? []).map(d => ({ v: d.id, t: d.name }));

  return (
    <div className="pg-alarms">
      <TopBar refresh={refresh} onRefresh={setRefresh} />

      {/* ======================= FILTER BAR ======================= */}
      <div className="toprow">
        <div className="filters">
          <div className="field"><label>Device</label>
            <MultiSelect head="Devices" any="All devices" value={fDev} options={devOpts} onChange={setFDev} /></div>
          <div className="field"><label>Severity</label>
            <MultiSelect head="Severity" any="Any severity" value={fSev} options={SEV_OPTS} onChange={setFSev} /></div>
          <div className="field"><label>Status</label>
            <MultiSelect head="Status" any="Any status" value={fSt} options={ST_OPTS} onChange={setFSt} /></div>
          {/* DATES, NOT DATE-TIMES: an alarm log is asked for by the day. The
              window runs from the start of the first day to the END of the last. */}
          <div className="field"><label>Start date</label>
            <div className="dt"><DateInput id="f-from-d" aria-label="Start date" value={fromD} onValue={setFromD} /></div></div>
          <div className="field"><label>End date</label>
            <div className="dt"><DateInput id="f-to-d" aria-label="End date" value={toD} onValue={setToD} /></div></div>
        </div>
      </div>

      <div className="wrap">
        {/* ======================= SUMMARY ======================= */}
        <div className="sumbar" id="sumbar">
          {[tile('All', ready ? rows.length : DASH, 'all'),
            tile('Active', ready ? act : DASH, act ? 'alarm' : 'ok'),
            tile('Resolved', ready ? rows.length - act : DASH, 'ok'),
            tile('Alarm', ready ? alarm : DASH, alarm ? 'alarm' : 'ok'),
            tile('Event', ready ? event : DASH, 'event'),
            tile('Warning', ready ? warn : DASH, warn ? 'warn' : 'ok'),
            tile('Critical', ready ? crit : DASH, crit ? 'crit' : 'ok')]}
        </div>

        {/* ======================= ALARM DATA ======================= */}
        <div className="card">
          <div className="chead">
            <div className="title">Alarm Data</div>
            <div className="tools">
              <button className="tbtn" type="button" onClick={exportCsv} disabled={!ready}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11m0 0-4.2-4.2M12 15l4.2-4.2M4.5 20h15" /></svg>EXPORT CSV</button>
            </div>
          </div>
          <div className="tablewrap">
            <table ref={tableRef}>
              <thead>
                <tr>{COLDEF.map(c => <th key={c.k} className={ready && log.data!.length ? undefined : 'ph'}>{c.t}</th>)}</tr>
              </thead>
              <tbody>
                {!ready ? (
                  <tr><td colSpan={COLDEF.length}>
                    {log.error ? <Failed error={log.error} what="the alarm log" onRetry={log.reload} /> : <Waiting what="Loading alarms" />}
                  </td></tr>
                ) : !log.data!.length ? (
                  <tr><td colSpan={COLDEF.length}><div className="empty-note tall">No alarms in this window</div></td></tr>
                ) : !slice.length ? (
                  <tr><td colSpan={COLDEF.length}><div className="empty-note tall">No alarms match these filters</div></td></tr>
                ) : slice.map(a => {
                  const d = toDate(a.receivedAt);
                  const k = d ? dayKey(d) : -1;
                  const head = k !== lastDay && d;
                  lastDay = k;
                  const n = perDay.get(k) ?? 0;
                  return (
                    <Fragment key={a.id}>
                      {head && (
                        <tr className="dh"><td colSpan={COLDEF.length}>
                          <span className="d">{WDAY[d.getDay()] + ' · ' + d.getDate() + ' ' + MON[d.getMonth()]}</span>
                          <span className="n">{n + (n === 1 ? ' alarm' : ' alarms')}</span>
                        </td></tr>
                      )}
                      <tr>
                        <td className="ts">{dt24(d)}</td>
                        {a.resolvedAt ? <td className="ts">{dt24(toDate(a.resolvedAt))}</td> : <td className="dim">{DASH}</td>}
                        <td><span className={'stt ' + a.status}>{a.status.toUpperCase()}</span></td>
                        <td className="msg">{a.text}</td>
                        <td>{a.id}</td>
                        <td><span className={'sev ' + a.severity}>{SEVWORD(a.severity)}</span></td>
                        <td>{a.deviceName}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TableFooter per={per} onPer={setPer} from={from} shown={slice.length} total={rows.length}
                       onPage={d => setPage(Math.max(0, Math.min(pages - 1, pg + d)))} />
        </div>
      </div>
      <RowPopover tableRef={tableRef} />
    </div>
  );
}
