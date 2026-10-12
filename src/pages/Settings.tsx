import { useEffect, useState, type JSX } from 'react';
import * as api from '../api/portal';
import { useAuth } from '../auth/AuthContext';
import { useSite } from '../auth/SiteContext';
import { Failed, Waiting } from '../components/DataState';
import { SettingsBar } from '../components/TopBar';
import { useApi } from '../hooks/useApi';
import { AccessCtlPane, AlarmsConfigPane, RolePane, UserPane } from './settings/AccessPanes';
import { AskProvider } from './settings/common';
import { CompanyPane, UserProfilePane } from './settings/ProfilePanes';
import { DevicesPane, OffsetPane, RatePane } from './settings/SitePanes';
import '../styles/pages/settings.css';

/* SETTINGS - ten panes in four groups, reached from the account menu and left by
   the wordmark. Ported from design-mockup/settings.html; every record on it is
   read from and written to the backend, and after a write the pane re-reads
   its list, so what it shows is what the server holds.

   The hash carries the pane, so a link to one section lands on that section. */

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
  /* Role first: a role has to exist before anybody can hold one */
  { id: 'g-access', t: 'Access Management',
    icon: <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.6 7 9.4 4.1-1.8 7-5.2 7-9.4V6l-7-2.8z" /></svg>,
    items: [{ p: 'access-role', t: 'Role' }, { p: 'access-user', t: 'User' }, { p: 'access-ctl', t: 'Access Control' }] },
];
const ALL = GROUPS.flatMap(g => g.items.map(i => ({ ...i, g: g.t, gid: g.id })));
const fromHash = () => (ALL.find(i => i.p === window.location.hash.slice(1)) ?? ALL[0]).p;

const CHEV = <svg className="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7" /></svg>;

export default function Settings() {
  const { site, sites, error: siteErr, reloadSites } = useSite();
  const { patchUser } = useAuth();
  const [cur, setCur] = useState(fromHash);
  /* every group open on arrival: someone who came to find one thing should see all the names */
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const item = ALL.find(i => i.p === cur) ?? ALL[0];

  useEffect(() => {
    const h = () => setCur(fromHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  useEffect(() => {
    document.title = 'ENEROPS OS · ' + item.t;
    if (window.location.hash.slice(1) !== item.p) window.history.replaceState(null, '', '#' + item.p);
    /* a group cannot hold the current screen and be shut */
    setShut(s => (s[item.gid] ? { ...s, [item.gid]: false } : s));
    return () => { document.title = 'ENEROPS OS'; };
  }, [item]);

  const roles = useApi(s => api.getRoles({ signal: s }), []);
  const users = useApi(s => api.getUsers({ signal: s }), []);
  const is = (p: string) => cur === p;

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
            {GROUPS.map(g => (
              <div className={'grp' + (shut[g.id] ? ' shut' : '')} id={g.id} key={g.id}>
                <button className="grpbtn" onClick={() => setShut(s => ({ ...s, [g.id]: !s[g.id] }))}>{g.icon}{g.t}{CHEV}</button>
                <div className="grpitems">
                  {g.items.map(i => <button key={i.p} className={'item' + (is(i.p) ? ' on' : '')} onClick={() => setCur(i.p)}>{i.t}</button>)}
                </div>
              </div>
            ))}
          </aside>

          <main className="main">
            {/* the heading names the GROUP, the card names the item */}
            <h1 className="pagehead">{item.g}</h1>
            <UserProfilePane on={is('user-profile')} onSaved={(name, email) => patchUser({ name, email })} />
            <CompanyPane on={is('company-profile')} />
            {/* the per-site panes follow the site chosen on Site Control */}
            {site ? (
              <>
                <DevicesPane on={is('customer-devices')} site={site} />
                <RatePane on={is('emission-rate')} site={site} kind="emission" />
                <RatePane on={is('electricity-rate')} site={site} kind="electricity" />
                <OffsetPane on={is('energy-offset')} site={site} />
              </>
            ) : ['customer-devices', 'emission-rate', 'electricity-rate', 'energy-offset'].includes(cur) && (
              <section className="panel card on">
                {siteErr ? <Failed error={siteErr} what="your sites" onRetry={reloadSites} /> : <Waiting what="Loading sites" />}
              </section>
            )}
            <AlarmsConfigPane on={is('alarms-config')} users={users.data} />
            <RolePane on={is('access-role')} roles={roles} users={users.data} sites={sites ?? []} />
            <UserPane on={is('access-user')} users={users} roles={roles.data ?? []} />
            <AccessCtlPane on={is('access-ctl')} users={users} roles={roles.data ?? []} sites={sites ?? []} />
          </main>
        </div>
      </AskProvider>
    </div>
  );
}
