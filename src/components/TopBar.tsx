import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../auth/SiteContext';
import { time12 } from '../lib/format';
import { toggleTheme, isDark } from '../lib/theme';
import { SingleSelect } from './Select';
import { useToast } from './Toasts';
import { useApi } from '../hooks/useApi';
import { getLoggerStatus } from '../api/portal';
import { ApiError } from '../api/client';

export type Refresh = 'off' | '300' | '600' | '900';
export const refreshMs = (r: Refresh) => (r === 'off' ? 0 : Number(r) * 1000);

const REFRESH_OPTS = [
  { v: 'off', t: 'Off' }, { v: '300', t: '5 min' }, { v: '600', t: '10 min' }, { v: '900', t: '15 min' },
];

const TABS = [
  { to: '/sites', t: 'Site Control', title: 'Every site, on the globe' },
  { to: '/home', t: 'Home' },
  { to: '/monitoring', t: 'Monitoring' },
  { to: '/alarms', t: 'Alarms' },
  { to: '/analysis', t: 'Analysis' },
  { to: '/kpi', t: 'KPI' },
];

function ThemeButton() {
  const [dark, setDark] = useState(isDark);
  const t = dark ? 'Switch to light' : 'Switch to dark';
  return (
    <button className="themebtn" type="button" title={t} aria-label={t} onClick={() => setDark(toggleTheme())}>
      <svg className="sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
      </svg>
      <svg className="moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z" />
      </svg>
    </button>
  );
}

const LOGGER_POLL_MS = 180000;

function Notifications() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const st = useApi(signal => getLoggerStatus({ signal }), [], LOGGER_POLL_MS);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('click', away, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', away, true); document.removeEventListener('keydown', key); };
  }, [open]);
  const list = st.data;
  const allLive = !!list && list.length > 0 && list.every(l => l.live === true);
  const dot = !list && st.loading ? 'wait' : allLive ? 'ok' : 'bad';
  const dotTitle = dot === 'wait' ? 'Checking the loggers' : allLive ? 'Every logger is live' : 'A logger is not live';
  return (
    <div className={'notif' + (open ? ' open' : '')} ref={wrap}>
      <button className="notifbtn" type="button" ref={btn} title="Notifications" aria-label="Notifications"
              aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path fill="currentColor" d="M6.5 0C2.91 0 0 2.462 0 5.5c0 1.075.37 2.074 1 2.922V12l2.699-1.542A7.454 7.454 0 006.5 11c3.59 0 6.5-2.462 6.5-5.5S10.09 0 6.5 0z" />
          <path fill="currentColor" opacity=".55" d="M16 9.5c0-.987-.429-1.897-1.147-2.639C14.124 10.348 10.66 13 6.5 13c-.103 0-.202-.018-.305-.021C7.231 13.617 8.556 14 10 14c.449 0 .886-.04 1.307-.11L15 16v-4h-.012C15.627 11.285 16 10.425 16 9.5z" />
        </svg>
        <span className={'ndot ' + dot} title={dotTitle} />
      </button>
      <div className="notifmenu" role="menu">
        <div className="nhead">Notifications</div>
        <ul className="nlist">
          {st.error && !list && (
            <li className="nfail" role="alert">
              <span className="k">{st.error instanceof ApiError ? st.error.kind : 'FAILED'}</span>
              <span className="t">Could not load notifications</span>
              <button type="button" onClick={st.reload}>Try again</button>
            </li>
          )}
          {!list && !st.error && <li className="nnone">Loading…</li>}
          {list && !list.length && <li className="nnone">No loggers yet</li>}
          {list?.map((l, i) => (
            <li key={i} className={'nrow' + (l.live === false ? ' down' : '')} role="menuitem" onClick={() => setOpen(false)}>
              {'\u{1F4E3} '}<b>{(l.name ?? 'Unnamed logger') + ':'}</b>{' '}
              {l.live === true ? 'Data is Live' : l.live === false ? 'Data is not Live' : '—'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Account({ showSettings = true }: { showSettings?: boolean }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', key); };
  }, [open]);
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={'acct' + (open ? ' open' : '')}>
      <button className="avatar" aria-haspopup="menu" aria-expanded={open} title="Account"
              onClick={e => { e.stopPropagation(); setOpen(!open); }}>{initial}</button>
      <div className="acctmenu" role="menu">
        <div className="acctwho">
          <div className="nm">{user?.name || '—'}</div>
          <div className="em">{user?.email || ''}</div>
        </div>
        <div className="acctdiv" />
        {showSettings && (
          <Link className="acctitem" role="menuitem" to="/settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.1" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09A1.7 1.7 0 0 0 21 10.1a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" /></svg> Settings
          </Link>
        )}
        <button className="acctitem out" role="menuitem" type="button"
                onClick={async () => { await signOut(); nav('/login'); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 16.5v1.8a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V5.7a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1.8" /><path d="M19.8 12H9.4m10.4 0-3.2-3.2M19.8 12l-3.2 3.2" /></svg> Sign out
        </button>
      </div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return <span className="clock">{time12(now, true)}</span>;
}

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return on;
}

function Menu({ tabs, extra }: { tabs: ReactNode; extra: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    document.addEventListener('click', away, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', away, true); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className={'navwrap' + (open ? ' open' : '')} ref={wrap}>
      <button className="menubtn" type="button" ref={btn} title="Menu" aria-label="Menu"
              aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className="navpanel">
        <div className="nphead">Pages</div>
        <div className="npages" onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>{tabs}</div>
        {extra && <div className="npextra">{extra}</div>}
      </div>
    </div>
  );
}

interface Props {
  refresh?: Refresh;
  onRefresh?: (r: Refresh) => void;
}

export function TopBar({ refresh, onRefresh }: Props) {
  const { site } = useSite();
  const toast = useToast();
  const tablet = useMedia('(max-width:1239px)');
  const noClock = useMedia('(max-width:899px)');
  const phone = useMedia('(max-width:679px)');
  const tiny = useMedia('(max-width:419px)');
  const tabs = (
    <nav className="tabs">
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to} title={t.title} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>{t.t}</NavLink>
      ))}
    </nav>
  );
  const refreshCtl = refresh && onRefresh && (
    <div className="refresh">
      <span className="dot" style={{ animationPlayState: refresh === 'off' ? 'paused' : 'running', opacity: refresh === 'off' ? 0.35 : 1 }} />
      <span className="rl">Refresh</span>
      <SingleSelect variant="m" className="rsel" head="Live refresh" value={refresh} options={REFRESH_OPTS}
                    title="How often this page re-reads the plant" dim={v => v === 'off'}
                    onChange={v => {
                      onRefresh(v as Refresh);
                      toast(v === 'off' ? 'Live refresh paused' : 'Live refresh · every ' + Number(v) / 60 + ' min');
                    }} />
    </div>
  );
  const extra = phone && (
    <>
      {refreshCtl && <div className="nprow"><span className="npl">Refresh</span>{refreshCtl}</div>}
      <div className="nprow"><span className="npl">Light / dark</span><ThemeButton /></div>
    </>
  );
  return (
    <header className={'topbar' + (phone ? ' phone' : '')}>
      <div className="brand">
        <img className="logo" src="/logo/logo-mark.png" alt="EnerOps Data Systems Pvt Ltd" />
        {!tiny && <span className="btext"><span className="word">ENEROPS OS</span><span className="sub">SITE OVERVIEW</span></span>}
      </div>
      <div className="sitenow" title="The site every page in this portal is showing. Change it on the Sites tab.">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21.2s6.8-6 6.8-10.8a6.8 6.8 0 1 0-13.6 0c0 4.8 6.8 10.8 6.8 10.8z" /><circle cx="12" cy="10.2" r="2.5" /></svg>
        <span className="n">{site?.name ?? '—'}</span>
      </div>
      {!tablet && tabs}
      <div className="right">
        {!noClock && <Clock />}
        {!phone && refreshCtl}
        <Notifications />
        {!phone && <ThemeButton />}
        <Account />
        {tablet && <Menu tabs={tabs} extra={extra} />}
      </div>
    </header>
  );
}

export function SettingsBar() {
  return (
    <header className="topbar">
      <Link className="brand" to="/home" title="Back to the portal" aria-label="Back to the portal">
        <img className="logo" src="/logo/logo-mark.png" alt="EnerOps Data Systems Pvt Ltd" />
        <span className="btext"><span className="word">ENEROPS OS</span><span className="sub">Site Overview</span></span>
      </Link>
      <div className="right">
        <ThemeButton />
        <Account showSettings={false} />
      </div>
    </header>
  );
}
