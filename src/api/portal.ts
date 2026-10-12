import { request } from './client';
import { EP } from './endpoints';
import * as A from './adapters';
import type {
  Alarm, AlarmStatus, DeviceLive, TimeSeries, DailyEnergy, DailyKpi, DayPowerSeries, Device, HomeKpiMetric,
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
