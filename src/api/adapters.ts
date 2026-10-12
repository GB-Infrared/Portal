import type {
  Alarm, DailyEnergy, DailyKpi, DayPowerSeries, Device, HomeKpiMetric, LoginResult,
  Reading, Severity, Site, SiteState, SiteSummary, User,
} from './types';

/* RAW BACKEND JSON -> THE SHAPES IN types.ts.

   Each adapter takes whatever the endpoint returned and builds the portal's
   type from it. As written they expect the field names in docs/API.md. Where
   the existing backend names a field differently, change the right-hand side
   here - e.g. `powerKw: num(r.power_kw)` - and nothing in the screens moves.

   They are also where "not measured" is made honest: a missing or non-numeric
   value becomes null, never 0, so the screens print a dash rather than a
   plausible-looking zero. */

type Raw = Record<string, any>;  // eslint-disable-line @typescript-eslint/no-explicit-any

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
export const str = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v : []);
const numArr = (v: unknown): (number | null)[] => (Array.isArray(v) ? v.map(num) : []);

const reading = (r: Raw | undefined | null): Reading => ({
  value: num(r?.value),
  updatedAt: str(r?.updatedAt),
});

export function adaptUser(r: Raw): User {
  return { id: String(r.id ?? r.email ?? ''), name: String(r.name ?? ''), email: String(r.email ?? ''), role: str(r.role) };
}

export function adaptLogin(r: Raw): LoginResult {
  return { token: str(r.token), user: adaptUser(r.user ?? {}) };
}

const SITE_STATES: SiteState[] = ['ok', 'warn', 'crit', 'off'];
export function adaptSite(r: Raw): Site {
  const st = str(r.state);
  return {
    id: String(r.id),
    name: String(r.name ?? r.id),
    address: str(r.address),
    lat: num(r.lat),
    lng: num(r.lng),
    acCapacityKw: num(r.acCapacityKw),
    dcCapacityKw: num(r.dcCapacityKw),
    deviceCount: num(r.deviceCount),
    downCount: num(r.downCount),
    warnCount: num(r.warnCount),
    critCount: num(r.critCount),
    powerKw: num(r.powerKw),
    energyTodayKwh: num(r.energyTodayKwh),
    state: st && (SITE_STATES as string[]).includes(st) ? (st as SiteState) : null,
    updatedAt: str(r.updatedAt),
  };
}
export const adaptSites = (r: unknown): Site[] => arr(r).map(adaptSite);

export function adaptSummary(r: Raw): SiteSummary {
  return {
    capacityKw: num(r.capacityKw),
    plantPowerKw: reading(r.plantPowerKw),
    peakPowerKw: { value: num(r.peakPowerKw?.value), at: str(r.peakPowerKw?.at) },
    energyTodayKwh: reading(r.energyTodayKwh),
    energyYesterdaySameTimeKwh: num(r.energyYesterdaySameTimeKwh),
    plantEnergyKwh: reading(r.plantEnergyKwh),
    performanceRatioPct: reading(r.performanceRatioPct),
    irradianceWm2: reading(r.irradianceWm2),
    revenue: reading(r.revenue),
    currency: str(r.currency),
    co2AvoidedKg: reading(r.co2AvoidedKg),
  };
}

export function adaptDevice(r: Raw): Device {
  const st = str(r.status);
  return {
    id: String(r.id),
    name: String(r.name ?? r.id),
    kind: String(r.kind ?? String(r.id).slice(0, 3)),
    status: st === 'warn' || st === 'down' ? st : 'ok',
    powerKw: num(r.powerKw),
    energyTodayKwh: num(r.energyTodayKwh),
    ratedKw: num(r.ratedKw),
    lastSeenAt: str(r.lastSeenAt),
  };
}
export const adaptDevices = (r: unknown): Device[] => arr(r).map(adaptDevice);

export function adaptDayPower(r: Raw): DayPowerSeries {
  return {
    date: String(r.date ?? ''),
    times: Array.isArray(r.times) ? r.times.map(String) : [],
    plantKw: numArr(r.plantKw),
    irradianceWm2: numArr(r.irradianceWm2),
    devices: arr(r.devices).map(d => ({ id: String(d.id), kw: numArr(d.kw) })),
  };
}

export function adaptDailyEnergy(r: Raw): DailyEnergy {
  return {
    year: Number(r.year), month: Number(r.month),
    days: arr(r.days).map(d => ({ day: Number(d.day), kwh: num(d.kwh) })),
  };
}

export function adaptDailyKpi(r: Raw, metric: HomeKpiMetric): DailyKpi {
  return {
    metric, year: Number(r.year), month: Number(r.month),
    days: arr(r.days).map(d => ({ day: Number(d.day), actual: num(d.actual), simulated: num(d.simulated) })),
  };
}

const SEVERITIES: Severity[] = ['critical', 'alarm', 'warn', 'event'];
export function adaptAlarm(r: Raw): Alarm {
  let sev = String(r.severity ?? 'event').toLowerCase();
  if (sev === 'warning') sev = 'warn';
  return {
    id: String(r.id),
    receivedAt: String(r.receivedAt),
    resolvedAt: str(r.resolvedAt),
    status: r.resolvedAt ? 'resolved' : (str(r.status) === 'resolved' ? 'resolved' : 'active'),
    text: String(r.text ?? ''),
    severity: (SEVERITIES as string[]).includes(sev) ? (sev as Severity) : 'event',
    deviceId: String(r.deviceId ?? ''),
    deviceName: String(r.deviceName ?? r.deviceId ?? ''),
    category: str(r.category),
  };
}
export const adaptAlarms = (r: unknown): Alarm[] => arr(r).map(adaptAlarm);
