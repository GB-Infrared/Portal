export type Iso = string;

export type AccountType = 'admin' | 'user';
export type AdminLevel = 'super' | 'admin' | 'plant';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  accountType: AccountType;
  level: AdminLevel | null;
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
export type AlarmStatus = 'active' | 'acknowledged' | 'resolved';
export interface AlarmAck { by: string; at: Iso; note: string }

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
  ack: AlarmAck | null;
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

export interface CommAlarm { siteId: string; code: string; text: string | null; deviceName: string; receivedAt: Iso }

export interface WaCustomer {
  id: string; name: string; legalName: string; companyEmail: string; phone: string; address: string;
  adminFirst: string; adminLast: string; adminEmail: string;
  plantCount: number | null; loggerCount: number | null; deviceCount: number | null;
}
export type Metric = 'pr' | 'cuf' | 'grid' | 'plant' | 'yield' | 'loss';
export type EnergySource = 'inverter' | 'meter';
export interface SourcePick { source: EnergySource; meter: string }
export interface KpiSetting { bar: boolean; aux: boolean; poi: boolean }
export interface WaPlant {
  id: string; customerId: string; name: string; area: string; city: string; state: string; country: string; zip: string;
  lat: number | null; lng: number | null; address: string; description: string;
  acKw: number | null; dcKwp: number | null; pstcKwp: number | null; moduleWp: number | null; minIrradiance: number | null;
  installedOn: string | null; irradiationSensors: string[]; pages: string[]; irradiance: 'inclined' | 'horizontal'; timezone: string;
  energySource: SourcePick; metricMeters: Record<Metric, string>; homeKpi: Metric; kpi: Record<Metric, KpiSetting>;
  homeSources: { power: SourcePick; energy: SourcePick; generation: SourcePick };
  addedBy: string | null; loggerCount: number | null; deviceCount: number | null;
}
export type WaPlantInput = Omit<WaPlant, 'id' | 'addedBy' | 'loggerCount' | 'deviceCount'>;
export interface WaLogger { id: string; plantId: string; name: string; description: string; deviceCount: number | null }
export type DeviceCategory = 'Inverter' | 'MFM' | 'WMS';
export interface WaDevice { id: string; loggerId: string; modelId: string; name: string; serial: string }
export interface CatalogModel { id: string; name: string; category: DeviceCategory; model: string; mapping: string }
export interface CatalogSensor { name: string; code: string; tag: string; unit: string; category: string }
export interface TeamUser { id: string; first: string; last: string; email: string; phone: string; level: 'admin' | 'plant'; roleId: string | null }
export interface TeamRole { id: string; name: string; customerIds: string[] }
