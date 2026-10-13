import { useEffect, useMemo, useState, type JSX } from 'react';
import * as api from '../api/portal';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../auth/SiteContext';
import { NoSite } from '../components/DataState';
import { SettingsBar } from '../components/TopBar';
import { useApi } from '../hooks/useApi';
import { AccessCtlPane, AlarmsConfigPane, RolePane, UserPane } from './settings/AccessPanes';
import { AskProvider } from './settings/common';
import { CompanyPane, UserProfilePane } from './settings/ProfilePanes';
import { DevicesPane, OffsetPane, RatePane } from './settings/SitePanes';
import '../styles/pages/settings.css';

const GROUPS: { id: string; t: string; icon: JSX.Element; items: { p: string; t: string }[] }[] = [
  { id: 'g-profile', t: 'Profile Management',
    icon: <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9.5" cy="8" r="3.4" /><path d="M3.4 20a6.6 6.6 0 0 1 12.2-3.4" /><circle cx="18.2" cy="17.6" r="2.1" /><path d="M18.2 13.9v1.1M18.2 20.2v1.1M21.4 15.8l-1 .5M16 19l-1 .5M21.4 19.4l-1-.5M16 16.2l-1-.5" /></svg>,
    items: [{ p: 'user-profile', t: 'User Profile' }, { p: 'company-profile', t: 'Company Profile' }] },
  { id: 'g-asset', t: 'Asset Management',
    icon: <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="13.5" width="7" height="7" rx="1.4" /><path d="M6.5 13.5V9.2a2 2 0 0 1 2-2h4.6" /><rect x="13" y="4" width="8" height="6.4" rx="1.4" /><path d="M17 10.4v3.4a2 2 0 0 1-2 2h-1.4" /></svg>,
    items: [{ p: 'customer-devices', t: 'Customer Devices' }] },
  { id: 'g-system', t: 'System Configuration',
    icon: <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.2 6.4a3.6 3.6 0 0 1 4.9-3.3l-2.4 2.4 1.8 1.8 2.4-2.4a3.6 3.6 0 0 1-4.5 4.6L6.6 19.7a1.9 1.9 0 0 1-2.7-2.7l10.2-10.2a3.6 3.6 0 0 1 .1-.4z" /></svg>,
    items: [{ p: 'emission-rate', t: 'Emission Rate' }, { p: 'electricity-rate', t: 'Electricity Rate' }, { p: 'energy-offset', t: 'Energy Offset' }, { p: 'alarms-config', t: 'Alarms config' }] },
  { id: 'g-access', t: 'Access Management',
    icon: <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.6 7 9.4 4.1-1.8 7-5.2 7-9.4V6l-7-2.8z" /></svg>,
    items: [{ p: 'access-role', t: 'Role' }, { p: 'access-user', t: 'User' }, { p: 'access-ctl', t: 'Access Control' }] },
];
const USER_PANES = ['user-profile', 'customer-devices'];
const ADMIN_SITE_PANES = ['emission-rate', 'electricity-rate', 'energy-offset'];
const groupsFor = (admin: boolean) => (admin ? GROUPS
  : GROUPS.map(g => ({ ...g, items: g.items.filter(i => USER_PANES.includes(i.p)) })).filter(g => g.items.length));
type Screen = { p: string; t: string; g: string; gid: string };
const screensOf = (groups: typeof GROUPS): Screen[] => groups.flatMap(g => g.items.map(i => ({ ...i, g: g.t, gid: g.id })));
const fromHash = (all: Screen[]) => (all.find(i => i.p === window.location.hash.slice(1)) ?? all[0]).p;
const ALL_SHUT: Record<string, boolean> = Object.fromEntries(GROUPS.map(g => [g.id, true]));

const CHEV = <svg className="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7" /></svg>;

export default function Settings() {
  const { site, sites, error: siteErr, loading: siteLoading, reloadSites } = useSite();
  const { user, patchUser } = useAuth();
  const admin = user?.accountType === 'admin';
  const groups = useMemo(() => groupsFor(admin), [admin]);
  const all = useMemo(() => screensOf(groups), [groups]);
  const [cur, setCur] = useState(() => fromHash(all));
  const [shut, setShut] = useState<Record<string, boolean>>(ALL_SHUT);
  const item = all.find(i => i.p === cur) ?? all[0];

  useEffect(() => {
    const h = () => {
      const p = fromHash(all);
      setCur(p);
      const gid = all.find(i => i.p === p)?.gid;
      if (gid) setShut(s => (s[gid] ? { ...s, [gid]: false } : s));
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, [all]);
  useEffect(() => {
    document.title = 'ENEROPS OS · ' + item.t;
    if (window.location.hash.slice(1) !== item.p) window.history.replaceState(null, '', '#' + item.p);
    return () => { document.title = 'ENEROPS OS'; };
  }, [item]);

  const roles = useApi(admin ? s => api.getRoles({ signal: s }) : null, [admin]);
  const users = useApi(admin ? s => api.getUsers({ signal: s }) : null, [admin]);
  const is = (p: string) => item.p === p;

  return (
    <div className="pg-settings">
      <AskProvider>
        <SettingsBar />
        <div className="shell">
          <aside className="side">
            <div className="sidehead">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.1" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.1 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09A1.7 1.7 0 0 0 21 10.1a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" /></svg>
              <span className="t">Settings</span>
            </div>
            {groups.map(g => (
              <div className={'grp' + (shut[g.id] ? ' shut' : '')} id={g.id} key={g.id}>
                <button className="grpbtn" onClick={() => setShut(s => ({ ...s, [g.id]: !s[g.id] }))}>{g.icon}{g.t}{CHEV}</button>
                <div className="grpitems">
                  {g.items.map(i => <button key={i.p} className={'item' + (is(i.p) ? ' on' : '')} onClick={() => setCur(i.p)}>{i.t}</button>)}
                </div>
              </div>
            ))}
          </aside>

          <main className="main">
            <h1 className="pagehead">{item.g}</h1>
            <UserProfilePane on={is('user-profile')} onSaved={(name, email) => patchUser({ name, email })} />
            {admin && <CompanyPane on={is('company-profile')} />}
            {site ? (
              <>
                <DevicesPane on={is('customer-devices')} site={site} readOnly={!admin} />
                {admin && (
                  <>
                    <RatePane on={is('emission-rate')} site={site} kind="emission" />
                    <RatePane on={is('electricity-rate')} site={site} kind="electricity" />
                    <OffsetPane on={is('energy-offset')} site={site} />
                  </>
                )}
              </>
            ) : ['customer-devices', ...ADMIN_SITE_PANES].includes(item.p) && (
              <section className="panel card on">
                <NoSite loading={siteLoading} error={siteErr} onRetry={reloadSites} />
              </section>
            )}
            {admin && (
              <>
                <AlarmsConfigPane on={is('alarms-config')} users={users.data} />
                <RolePane on={is('access-role')} roles={roles} users={users.data} sites={sites ?? []} />
                <UserPane on={is('access-user')} users={users} roles={roles.data ?? []} />
                <AccessCtlPane on={is('access-ctl')} users={users} roles={roles.data ?? []} sites={sites ?? []} />
              </>
            )}
          </main>
        </div>
      </AskProvider>
    </div>
  );
}
