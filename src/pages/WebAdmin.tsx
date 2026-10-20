import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { Navigate } from 'react-router-dom';
import * as api from '../api/portal';
import type { AdminLevel } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { AdminBar } from '../components/TopBar';
import { useApi, type ApiState } from '../hooks/useApi';
import { LEVEL_NAME } from '../lib/levels';
import { AskProvider } from './settings/common';
import { UserProfilePane } from './settings/ProfilePanes';
import { CustomersPane, DevicesPane, LoggersPane, ModelsPane, PlantsPane, SensorsPane, type Can, type Ctx, type Filters } from './webadmin/Panes';
import { AccessPane, RolesPane, UsersPane, type TeamCtx } from './webadmin/Team';
import '../styles/pages/webadmin.css';

interface Group { id: string; t: string; icon: JSX.Element; items: { p: string; t: string }[] }

const ICON_ME = <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></svg>;
const ICON_OPS = <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.4a6 6 0 0 1 3 5.6" /></svg>;
const ICON_PLANT = <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15.5 7 6.5h10l3 9z" /><path d="M5.5 11h13M12 6.5v9M8.5 15.5 7.5 20M15.5 15.5l1 4.5M6 20h12" /></svg>;
const ICON_CAT = <svg className="gi" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
const CHEV = <svg className="chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7" /></svg>;

function groupsFor(level: AdminLevel): Group[] {
  const g: Group[] = [{ id: 'g-me', t: 'My Profile', icon: ICON_ME, items: [{ p: 'profile', t: 'User Profile' }] }];
  if (level !== 'plant') {
    g.push({ id: 'g-ops', t: 'Account Management', icon: ICON_OPS, items: [
      ...(level === 'super' ? [{ p: 'customers', t: 'Customer Management' }] : []),
      { p: 'operators', t: level === 'admin' ? 'Plant Admin' : 'Users' }, { p: 'roles', t: 'Role' }, { p: 'assign', t: 'Access Control' },
    ] });
  }
  g.push({ id: 'g-plant', t: 'Plants & hardware', icon: ICON_PLANT, items: [
    { p: 'assets', t: 'Asset Management' }, { p: 'loggers', t: 'Logger Management' }, { p: 'cdevices', t: 'Customer Device Management' },
  ] });
  if (level !== 'plant') g.push({ id: 'g-cat', t: 'Device catalogue', icon: ICON_CAT, items: [{ p: 'devices', t: 'Devices List' }, { p: 'sensors', t: 'Sensors List' }] });
  return g;
}

function useFor<T>(key: string, load: (key: string, signal: AbortSignal) => Promise<T>): ApiState<T> {
  const raw = useApi(key ? s => load(key, s).then(d => ({ key, d })) : null, [key]);
  const fresh = !!raw.data && raw.data.key === key;
  return { ...raw, data: fresh && raw.data ? raw.data.d : null, loading: raw.loading || (!!key && !fresh && !raw.error) };
}

export default function WebAdmin() {
  const { user } = useAuth();
  if (!user?.level) return <Navigate to="/home" replace />;
  return <Panel level={user.level} email={user.email} />;
}

function Panel({ level, email }: { level: AdminLevel; email: string }) {
  const { patchUser } = useAuth();
  const groups = useMemo(() => groupsFor(level), [level]);
  const all = useMemo(() => groups.flatMap(g => g.items.map(i => ({ ...i, gid: g.id }))), [groups]);
  const fromHash = useCallback(() => (all.find(i => i.p === window.location.hash.slice(1)) ?? all[0]).p, [all]);
  const [cur, setCur] = useState(fromHash);
  const [shut, setShut] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map(g => [g.id, g.id !== 'g-me'])));
  const item = all.find(i => i.p === cur) ?? all[0];
  const is = (p: string) => item.p === p;

  useEffect(() => {
    const h = () => {
      const p = fromHash();
      setCur(p);
      const gid = all.find(i => i.p === p)?.gid;
      if (gid) setShut(s => (s[gid] ? { ...s, [gid]: false } : s));
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, [all, fromHash]);
  useEffect(() => {
    document.title = 'ENEROPS OS · Web admin · ' + item.t;
    if (window.location.hash.slice(1) !== item.p) window.history.replaceState(null, '', '#' + item.p);
    return () => { document.title = 'ENEROPS OS'; };
  }, [item]);

  const [F, setFilters] = useState<Filters>({ cust: '', plant: '', logger: '', model: '' });
  const setF = useCallback((p: Partial<Filters>) => setFilters(f => {
    const n = { ...f, ...p };
    if (n.cust !== f.cust) { n.plant = ''; n.logger = ''; }
    if (n.plant !== f.plant) n.logger = '';
    return n.cust === f.cust && n.plant === f.plant && n.logger === f.logger && n.model === f.model ? f : n;
  }), []);

  const customers = useApi(s => api.waGetCustomers({ signal: s }), []);
  const models = useApi(s => api.waGetModels({ signal: s }), []);
  const plants = useFor(F.cust, (id, s) => api.waGetPlants(id, { signal: s }));
  const loggers = useFor(F.plant, (id, s) => api.waGetLoggers(id, { signal: s }));
  const staff = level !== 'plant';
  const team = useApi(staff ? s => api.waGetTeam({ signal: s }) : null, [staff]);
  const roles = useApi(staff ? s => api.waGetRoles({ signal: s }) : null, [staff]);

  const first = (list: { id: string }[] | null, now: string) => (list && !list.some(x => x.id === now) ? list[0]?.id ?? '' : null);
  useEffect(() => { const v = first(customers.data, F.cust); if (v !== null) setF({ cust: v }); }, [customers.data, F.cust, setF]);
  useEffect(() => { const v = first(plants.data, F.plant); if (v !== null) setF({ plant: v }); }, [plants.data, F.plant, setF]);
  useEffect(() => { const v = first(loggers.data, F.logger); if (v !== null) setF({ logger: v }); }, [loggers.data, F.logger, setF]);
  useEffect(() => { const v = first(models.data, F.model); if (v !== null) setF({ model: v }); }, [models.data, F.model, setF]);

  const can: Can = useMemo(() => ({
    customers: level === 'super', addCustomer: level === 'super', editCustomer: level === 'super', deleteCustomer: level === 'super',
    manageUsers: staff, manageRoles: staff, plantLevel: level === 'plant',
    plant: p => !!p && (level !== 'plant' || (p.addedBy ?? '').toLowerCase() === email.toLowerCase()),
  }), [level, staff, email]);
  const ctx: Ctx = { can, customers, plants, loggers, models, F, setF };
  const t: TeamCtx = { team, roles, customers: customers.data, adminView: level === 'admin', manageUsers: staff, manageRoles: staff };

  return (
    <div className="pg-webadmin">
      <AskProvider>
        <AdminBar />
        <div className="shell">
          <aside className="side">
            <div className="sidehead">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.6 7 9.4 4.1-1.8 7-5.2 7-9.4V6l-7-2.8z" /><path d="M9.2 12.2l2 2 3.8-4" /></svg>
              <span className="t">Web admin</span>
            </div>
            {groups.map(g => (
              <div className={'grp' + (shut[g.id] ? ' shut' : '')} id={g.id} key={g.id}>
                <button className="grpbtn" onClick={() => setShut(s => ({ ...s, [g.id]: !s[g.id] }))}>{g.icon}{g.t}{CHEV}</button>
                <div className="grpitems">
                  {g.items.map(i => <button key={i.p} className={'item' + (is(i.p) ? ' on' : '')} data-p={i.p} onClick={() => setCur(i.p)}>{i.t}</button>)}
                </div>
              </div>
            ))}
          </aside>

          <main className="main">
            <h1 className="pagehead">{item.t}</h1>
            <UserProfilePane on={is('profile')} bare readOnly={level === 'plant'} role={LEVEL_NAME[level]}
                             onSaved={(name, mail) => patchUser({ name, email: mail })} />
            {can.customers && <CustomersPane on={is('customers')} ctx={ctx} />}
            {staff && (
              <>
                <UsersPane on={is('operators')} t={t} />
                <RolesPane on={is('roles')} t={t} />
                <AccessPane on={is('assign')} t={t} />
              </>
            )}
            <PlantsPane on={is('assets')} ctx={ctx} />
            <LoggersPane on={is('loggers')} ctx={ctx} />
            <DevicesPane on={is('cdevices')} ctx={ctx} />
            {staff && (
              <>
                <ModelsPane on={is('devices')} ctx={ctx} />
                <SensorsPane on={is('sensors')} ctx={ctx} />
              </>
            )}
          </main>
        </div>
      </AskProvider>
    </div>
  );
}
