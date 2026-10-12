import { request } from './client';
import { EP } from './endpoints';
import * as A from './adapters';
import type {
  Alarm, AlarmStatus, DeviceLive, TimeSeries, KpiBucket, KpiMetric,
  Profile, Company, RateKind, RatePeriod, EnergyOffset, AlarmRecipient, Role, AccountUser, Severity, DailyEnergy, DailyKpi, DayPowerSeries, Device, HomeKpiMetric,
  LoginResult, Site, SiteSummary, User,
} from './types';

/* WHAT THE SCREENS CAN ASK FOR. One function per question, each a path from
   endpoints.ts and an adapter from adapters.ts. Screens import from here and
   from nowhere else in this folder. */

type Sig = { signal?: AbortSignal };

/* ---------------- session ---------------- */

export async function login(email: string, password: string, o: Sig = {}): Promise<LoginResult> {
  const r = await request<Record<string, unknown>>(EP.login(), {
    method: 'POST', body: { email, password }, signal: o.signal, skipAuthRedirect: true,
  });
  return A.adaptLogin(r);
}

export async function logout(): Promise<void> {
  await request(EP.logout(), { method: 'POST', skipAuthRedirect: true });
}

export async function me(o: Sig = {}): Promise<User> {
  return A.adaptUser(await request(EP.me(), { signal: o.signal, skipAuthRedirect: true }));
}

/* ---------------- sites ---------------- */

export async function getSites(o: Sig = {}): Promise<Site[]> {
  return A.adaptSites(await request(EP.sites(), { signal: o.signal }));
}

export async function getSiteSummary(siteId: string, o: Sig = {}): Promise<SiteSummary> {
  return A.adaptSummary(await request(EP.siteSummary(siteId), { signal: o.signal }));
}

export async function getSiteDevices(siteId: string, o: Sig = {}): Promise<Device[]> {
  return A.adaptDevices(await request(EP.siteDevices(siteId), { signal: o.signal }));
}

/** date: YYYY-MM-DD in the site's day */
export async function getDayPower(siteId: string, date: string, o: Sig = {}): Promise<DayPowerSeries> {
  return A.adaptDayPower(await request(EP.sitePowerDay(siteId), { query: { date }, signal: o.signal }));
}

/** month: 1-12 */
export async function getDailyEnergy(siteId: string, year: number, month: number, o: Sig = {}): Promise<DailyEnergy> {
  return A.adaptDailyEnergy(await request(EP.siteEnergyDaily(siteId), { query: { year, month }, signal: o.signal }));
}

export async function getDailyKpi(siteId: string, metric: HomeKpiMetric, year: number, month: number, o: Sig = {}): Promise<DailyKpi> {
  return A.adaptDailyKpi(await request(EP.siteKpiDaily(siteId), { query: { metric, year, month }, signal: o.signal }), metric);
}

export interface AlarmQuery {
  status?: AlarmStatus;
  /** ISO times bounding when the alarm was received */
  from?: string;
  to?: string;
}
export async function getAlarms(siteId: string, q: AlarmQuery = {}, o: Sig = {}): Promise<Alarm[]> {
  return A.adaptAlarms(await request(EP.siteAlarms(siteId), { query: { ...q }, signal: o.signal }));
}

export async function getDeviceLive(siteId: string, deviceId: string, o: Sig = {}): Promise<DeviceLive> {
  return A.adaptDeviceLive(await request(EP.deviceLive(siteId, deviceId), { signal: o.signal }));
}

export interface SeriesQuery {
  devices: string[];
  /** a tag from the parameter catalogue: P_AC, S_AC, GHI ... */
  param: string;
  /** ISO times; `to` is exclusive */
  from: string;
  to: string;
  /** bucket size: "5m", "15m", "1h", "1d" ... */
  interval: string;
  /** how a bucket is reduced: "avg" (default), "max", "last" */
  agg?: 'avg' | 'max' | 'last';
}
export async function getTimeSeries(siteId: string, q: SeriesQuery, o: Sig = {}): Promise<TimeSeries> {
  return A.adaptTimeSeries(await request(EP.timeseries(siteId), {
    query: { devices: q.devices, param: q.param, from: q.from, to: q.to, interval: q.interval, agg: q.agg },
    signal: o.signal,
  }));
}

/** granularity "day": every day of `month` in `year`. "month": every month of `year`. */
export async function getKpi(siteId: string, q: { metric: KpiMetric; granularity: 'day' | 'month'; year: number; month?: number }, o: Sig = {}): Promise<KpiBucket[]> {
  return A.adaptKpiBuckets(await request(EP.kpi(siteId), { query: { ...q }, signal: o.signal }));
}

/* ---------------- settings ----------------
   After a write succeeds the screen re-reads the list, so what it shows is
   what the server holds - never a local guess at what the write did. */

export async function getProfile(o: Sig = {}): Promise<Profile> { return A.adaptProfile(await request(EP.profile(), { signal: o.signal })); }
export async function saveProfile(p: Omit<Profile, 'roleLabel'>): Promise<void> { await request(EP.profile(), { method: 'PUT', body: p }); }
/** a refusal (e.g. the current password is wrong) carries the backend's reason in ApiError.message */
export async function changePassword(current: string, next: string): Promise<void> {
  await request(EP.password(), { method: 'POST', body: { current, next }, skipAuthRedirect: true });
}
export async function getCompany(o: Sig = {}): Promise<Company> { return A.adaptCompany(await request(EP.company(), { signal: o.signal })); }

export async function renameDevice(siteId: string, deviceId: string, name: string): Promise<void> {
  await request(EP.device(siteId, deviceId), { method: 'PATCH', body: { name } });
}

export async function getRates(siteId: string, kind: RateKind, o: Sig = {}): Promise<RatePeriod[]> {
  return A.adaptRates(await request(EP.rates(siteId, kind), { signal: o.signal }));
}
export async function addRate(siteId: string, kind: RateKind, from: string, rate: number): Promise<void> {
  await request(EP.rates(siteId, kind), { method: 'POST', body: { from, rate } });
}
export async function removeRate(siteId: string, kind: RateKind, from: string): Promise<void> {
  await request(EP.rate(siteId, kind, from), { method: 'DELETE' });
}

export async function getOffsets(siteId: string, o: Sig = {}): Promise<EnergyOffset[]> {
  return A.adaptOffsets(await request(EP.offsets(siteId), { signal: o.signal }));
}
export async function addOffset(siteId: string, x: { deviceId: string; from: string; kwh: number; reason: string }): Promise<void> {
  await request(EP.offsets(siteId), { method: 'POST', body: x });
}
export async function removeOffset(siteId: string, deviceId: string, from: string): Promise<void> {
  await request(EP.offset(siteId, deviceId, from), { method: 'DELETE' });
}

export async function getRecipients(o: Sig = {}): Promise<AlarmRecipient[]> { return A.adaptRecipients(await request(EP.recipients(), { signal: o.signal })); }
export async function saveRecipient(id: string | null, x: { name: string; email: string; severities: Record<Severity, boolean> }): Promise<void> {
  await request(id ? EP.recipient(id) : EP.recipients(), { method: id ? 'PUT' : 'POST', body: x });
}
export async function removeRecipient(id: string): Promise<void> { await request(EP.recipient(id), { method: 'DELETE' }); }

export async function getRoles(o: Sig = {}): Promise<Role[]> { return A.adaptRoles(await request(EP.roles(), { signal: o.signal })); }
export async function saveRole(id: string | null, x: { name: string; siteIds: string[] }): Promise<void> {
  await request(id ? EP.role(id) : EP.roles(), { method: id ? 'PUT' : 'POST', body: x });
}
export async function removeRole(id: string): Promise<void> { await request(EP.role(id), { method: 'DELETE' }); }

export async function getUsers(o: Sig = {}): Promise<AccountUser[]> { return A.adaptUsers(await request(EP.users(), { signal: o.signal })); }
/** details only - a role is never set here, only on Access Control */
export async function saveUser(id: string | null, x: { first: string; last: string; email: string; phone: string }): Promise<void> {
  await request(id ? EP.user(id) : EP.users(), { method: id ? 'PUT' : 'POST', body: x });
}
export async function setUserActive(id: string, active: boolean): Promise<void> { await request(EP.userStatus(id), { method: 'PUT', body: { active } }); }
export async function setUserRole(id: string, roleId: string | null): Promise<void> { await request(EP.userRole(id), { method: 'PUT', body: { roleId } }); }
