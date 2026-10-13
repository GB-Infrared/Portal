import type {
  DeviceLive, TimeSeries, KpiBucket, PortfolioToday, Profile, Company, RatePeriod, EnergyOffset, AlarmRecipient, Role, AccountUser,
  Alarm, DailyEnergy, DailyKpi, DayPowerSeries, Device, HomeKpiMetric, LoginResult,
  Reading, Severity, Site, SiteState, SiteSummary, User,
} from './types';

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
  return { id: String(r.id ?? r.email ?? ''), name: String(r.name ?? ''), email: String(r.email ?? ''), role: str(r.role), accountType: r.accountType === 'admin' ? 'admin' : 'user' };
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
    peakKwToday: num(r.peakKwToday),
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
    energyTotalKwh: num(r.energyTotalKwh),
    model: str(r.model),
    commissionedOn: str(r.commissionedOn),
    retired: !!r.retired,
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

export function adaptDeviceLive(r: Raw): DeviceLive {
  const st = str(r.status);
  const values: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(r.values ?? {})) values[k] = num(v);
  return {
    deviceId: String(r.deviceId ?? ''),
    status: st === 'warn' || st === 'down' ? st : 'ok',
    model: str(r.model), ratedKw: num(r.ratedKw), values, updatedAt: str(r.updatedAt),
  };
}

export function adaptTimeSeries(r: Raw): TimeSeries {
  return {
    param: String(r.param ?? ''), unit: str(r.unit), interval: String(r.interval ?? ''),
    times: Array.isArray(r.times) ? r.times.map(String) : [],
    series: arr(r.series).map(x => ({ deviceId: String(x.deviceId), values: numArr(x.values) })),
  };
}

export const adaptKpiBuckets = (r: unknown): KpiBucket[] =>
  arr((r as Raw)?.buckets ?? r).map(b => ({
    key: String(b.key), actual: num(b.actual), simulated: num(b.simulated), forecast: num(b.forecast), partial: !!b.partial,
  }));

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export const adaptProfile = (r: Raw): Profile => ({
  first: text(r.first), last: text(r.last), company: text(r.company), address: text(r.address),
  email: text(r.email), phone: text(r.phone), roleLabel: str(r.roleLabel),
});
export const adaptCompany = (r: Raw): Company => ({
  name: text(r.name), address: str(r.address), companyEmail: str(r.companyEmail), adminEmail: str(r.adminEmail),
  phone: str(r.phone), serviceActive: r.serviceActive === undefined || r.serviceActive === null ? null : !!r.serviceActive,
});
export const adaptRates = (r: unknown): RatePeriod[] => arr(r)
  .map(x => ({ from: String(x.from), rate: Number(x.rate), addedAt: str(x.addedAt) }))
  .sort((a, b) => (a.from < b.from ? -1 : 1));
export const adaptOffsets = (r: unknown): EnergyOffset[] => arr(r)
  .map(x => ({ deviceId: String(x.deviceId), from: String(x.from), kwh: Number(x.kwh), reason: text(x.reason), addedAt: str(x.addedAt) }));
export const adaptRecipients = (r: unknown): AlarmRecipient[] => arr(r).map(x => ({
  id: String(x.id), name: text(x.name), email: text(x.email),
  severities: { critical: !!x.severities?.critical, alarm: !!x.severities?.alarm, warn: !!(x.severities?.warn ?? x.severities?.warning), event: !!x.severities?.event },
}));
export const adaptRoles = (r: unknown): Role[] => arr(r).map(x => ({
  id: String(x.id), name: text(x.name), siteIds: Array.isArray(x.siteIds) ? x.siteIds.map(String) : [],
}));
export const adaptUsers = (r: unknown): AccountUser[] => arr(r).map(x => ({
  id: String(x.id), first: text(x.first), last: text(x.last), email: text(x.email), phone: text(x.phone),
  roleId: str(x.roleId) || null, active: x.active !== false,
}));

export const adaptPortfolio = (r: Raw): PortfolioToday => ({
  revenue: num(r.revenue), currency: str(r.currency), co2AvoidedKg: num(r.co2AvoidedKg),
  times: Array.isArray(r.times) ? r.times.map(String) : [], kw: numArr(r.kw),
});
