export type Iso = string;

export type AccountType = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  accountType: AccountType;
}

export interface LoginResult {
  token?: string | null;
  user: User;
}

export type SiteState = 'ok' | 'warn' | 'crit' | 'off';

export interface Site {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  acCapacityKw: number | null;
  dcCapacityKw: number | null;
  deviceCount: number | null;
  downCount: number | null;
  warnCount: number | null;
  critCount: number | null;
  powerKw: number | null;
  energyTodayKwh: number | null;
  peakKwToday: number | null;
  state: SiteState | null;
  updatedAt: Iso | null;
}

export interface PortfolioToday {
  revenue: number | null;
  currency: string | null;
  co2AvoidedKg: number | null;
  times: Iso[];
  kw: (number | null)[];
}

export interface Reading {
  value: number | null;
  updatedAt: Iso | null;
}

export interface SiteSummary {
  capacityKw: number | null;
  plantPowerKw: Reading;
  peakPowerKw: { value: number | null; at: Iso | null };
  energyTodayKwh: Reading;
  energyYesterdaySameTimeKwh: number | null;
  plantEnergyKwh: Reading;
  performanceRatioPct: Reading;
  irradianceWm2: Reading;
  revenue: Reading;
  currency: string | null;
  co2AvoidedKg: Reading;
}

export type DeviceKind = 'INV' | 'MFM' | 'WMS' | string;
export type DeviceStatus = 'ok' | 'warn' | 'down';

export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  status: DeviceStatus;
  powerKw: number | null;
  energyTodayKwh: number | null;
  ratedKw: number | null;
  lastSeenAt: Iso | null;
  energyTotalKwh: number | null;
  model: string | null;
  commissionedOn: string | null;
  retired: boolean;
}

export interface DeviceLive {
  deviceId: string;
  status: DeviceStatus;
  model: string | null;
  ratedKw: number | null;
  values: Record<string, number | null>;
  updatedAt: Iso | null;
}

export interface TimeSeries {
  param: string;
  unit: string | null;
  interval: string;
  times: Iso[];
  series: { deviceId: string; values: (number | null)[] }[];
}

export interface DayPowerSeries {
  date: string;
  times: Iso[];
  plantKw: (number | null)[];
  irradianceWm2: (number | null)[];
  devices: { id: string; kw: (number | null)[] }[];
}

export interface DailyEnergy {
  year: number;
  month: number;
  days: { day: number; kwh: number | null }[];
}

export type HomeKpiMetric = 'CUF' | 'PR' | 'Availability';

export interface DailyKpi {
  metric: HomeKpiMetric;
  year: number;
  month: number;
  days: { day: number; actual: number | null; simulated: number | null }[];
}

export type KpiMetric = 'PR' | 'CUF' | 'AVAIL' | 'YIELD' | 'ENERGY' | 'IRR';

export interface KpiBucket {
  key: string;
  actual: number | null;
  simulated: number | null;
  forecast: number | null;
  partial: boolean;
}

export type Severity = 'critical' | 'alarm' | 'warn' | 'event';
export type AlarmStatus = 'active' | 'resolved';

export interface Alarm {
  id: string;
  receivedAt: Iso;
  resolvedAt: Iso | null;
  status: AlarmStatus;
  text: string;
  severity: Severity;
  deviceId: string;
  deviceName: string;
  category: string | null;
}

export interface Profile {
  first: string; last: string; company: string; address: string; email: string; phone: string;
  roleLabel: string | null;
}

export interface Company {
  name: string;
  address: string | null;
  companyEmail: string | null;
  adminEmail: string | null;
  phone: string | null;
  serviceActive: boolean | null;
}

export type RateKind = 'emission' | 'electricity';
export interface RatePeriod { from: string; rate: number; addedAt: string | null }

export interface EnergyOffset { deviceId: string; from: string; kwh: number; reason: string; addedAt: string | null }

export interface AlarmRecipient { id: string; name: string; email: string; severities: Record<Severity, boolean> }

export interface Role { id: string; name: string; siteIds: string[] }

export interface AccountUser { id: string; first: string; last: string; email: string; phone: string; roleId: string | null; active: boolean }

export interface LoggerStatus { name: string | null; live: boolean | null }
