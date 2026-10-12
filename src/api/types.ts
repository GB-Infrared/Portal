/* The shapes the screens read. These are the portal's side of the contract:
   whatever the backend returns is mapped into these in adapters.ts, so a field
   that is named differently on the server is renamed in one place, not in every
   screen.

   Two rules hold everywhere:
   - A value the backend did not measure is null, never 0. Nothing measured and
     zero measured are different facts; the screens print null as "—".
   - Times are ISO 8601 strings with an offset ("2026-07-27T12:10:03+05:30").
     The screens format them in the browser's local time. */

export type Iso = string;

/* ---------------- session ---------------- */

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string | null;
}

export interface LoginResult {
  /** bearer mode only; cookie mode leaves it out */
  token?: string | null;
  user: User;
}

/* ---------------- sites ---------------- */

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
  /** devices not reporting / with warnings / with critical alarms */
  downCount: number | null;
  warnCount: number | null;
  critCount: number | null;
  /** live readings for Site Control's card and the portfolio total */
  powerKw: number | null;
  energyTodayKwh: number | null;
  /** the highest power reached so far today */
  peakKwToday: number | null;
  state: SiteState | null;
  updatedAt: Iso | null;
}

/** What the whole portfolio adds up to today, for Site Control's strip. */
export interface PortfolioToday {
  revenue: number | null;
  currency: string | null;
  co2AvoidedKg: number | null;
  /** the portfolio's summed power across today, on one time axis */
  times: Iso[];
  kw: (number | null)[];
}

/* ---------------- readings ---------------- */

/** One figure and when it was read. */
export interface Reading {
  value: number | null;
  updatedAt: Iso | null;
}

/** Home's KPI strip. */
export interface SiteSummary {
  capacityKw: number | null;
  plantPowerKw: Reading;
  peakPowerKw: { value: number | null; at: Iso | null };
  energyTodayKwh: Reading;
  /** energy produced yesterday up to the same time of day, for the delta */
  energyYesterdaySameTimeKwh: number | null;
  plantEnergyKwh: Reading;
  performanceRatioPct: Reading;
  irradianceWm2: Reading;
  revenue: Reading;
  /** currency symbol for revenue, e.g. "₹" */
  currency: string | null;
  co2AvoidedKg: Reading;
}

/* ---------------- devices ---------------- */

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
  /** lifetime energy, for Monitoring's rail */
  energyTotalKwh: number | null;
  /** make and model, e.g. "HVERTER SI-350K-NO" */
  model: string | null;
  /** YYYY-MM-DD, for the Settings register */
  commissionedOn: string | null;
  /** taken out of service: still on the register, never offered for new records */
  retired: boolean;
}

/** One device's latest readings, keyed by tag (P_AC, S_AC, I_AC1 ...). */
export interface DeviceLive {
  deviceId: string;
  status: DeviceStatus;
  model: string | null;
  ratedKw: number | null;
  values: Record<string, number | null>;
  updatedAt: Iso | null;
}

/** Any tag for any set of devices over a window, on one shared time axis.
 *  With interval "1d" and agg "max" it is one value per day: the daily peak. */
export interface TimeSeries {
  param: string;
  unit: string | null;
  interval: string;
  times: Iso[];
  series: { deviceId: string; values: (number | null)[] }[];
}

/* ---------------- time series ---------------- */

/** Power against irradiance for one day: one timestamp axis, the plant total,
 *  the irradiance, and each inverter on the same axis. */
export interface DayPowerSeries {
  date: string;                 /* YYYY-MM-DD */
  times: Iso[];
  plantKw: (number | null)[];
  irradianceWm2: (number | null)[];
  devices: { id: string; kw: (number | null)[] }[];
}

/** One value per day of a month, null where there is none (yet). */
export interface DailyEnergy {
  year: number;
  month: number;               /* 1-12 */
  days: { day: number; kwh: number | null }[];
}

export type HomeKpiMetric = 'CUF' | 'PR' | 'Availability';

export interface DailyKpi {
  metric: HomeKpiMetric;
  year: number;
  month: number;
  days: { day: number; actual: number | null; simulated: number | null }[];
}

/* ---------------- KPI page ---------------- */

export type KpiMetric = 'PR' | 'CUF' | 'AVAIL' | 'YIELD' | 'ENERGY' | 'IRR';

/** One bucket (a day, or a month) of one metric, three ways: ACTUAL what the
 *  plant did (only for elapsed time), SIMULATED what the design model says it
 *  should have done, FORECAST what it is expected to do (only ahead of now).
 *  A bucket only part elapsed has `partial` set; its actual covers the elapsed
 *  part and its forecast the rest. A month bucket must be the roll-up of its
 *  days, so the daily and monthly views agree. */
export interface KpiBucket {
  /** day: YYYY-MM-DD, month: YYYY-MM */
  key: string;
  actual: number | null;
  simulated: number | null;
  forecast: number | null;
  partial: boolean;
}

/* ---------------- alarms ---------------- */

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

/* ---------------- settings ---------------- */

export interface Profile {
  first: string; last: string; company: string; address: string; email: string; phone: string;
  /** how the account describes this person, e.g. "Site administrator" */
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

/** Emission (kg CO2 per kWh) or electricity (currency per kWh): a HISTORY,
 *  one rate per period, superseded and never edited. There is no end date -
 *  a rate runs until the next one starts. */
export type RateKind = 'emission' | 'electricity';
export interface RatePeriod { from: string; rate: number; addedAt: string | null }

/** A correction to one device's metered generation, versioned per device. */
export interface EnergyOffset { deviceId: string; from: string; kwh: number; reason: string; addedAt: string | null }

export interface AlarmRecipient { id: string; name: string; email: string; severities: Record<Severity, boolean> }

/** A role is a name and the sites it reaches - nothing else. */
export interface Role { id: string; name: string; siteIds: string[] }

/** Suspended, never deleted: an alarm acknowledged by somebody who no longer
 *  exists still has to say who acknowledged it. */
export interface AccountUser { id: string; first: string; last: string; email: string; phone: string; roleId: string | null; active: boolean }
