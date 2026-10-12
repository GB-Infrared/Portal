/* Every path the portal calls, in one table. When the portal is connected to
   the existing backend, this is the file to edit: point each entry at the
   route that already serves that data. Paths are relative to API_BASE_URL.
   docs/API.md lists what each one must return. */

const enc = encodeURIComponent;

export const EP = {
  /* session */
  login: () => '/auth/login',
  logout: () => '/auth/logout',
  me: () => '/auth/me',
  passwordReset: () => '/auth/password-reset',

  /* sites */
  sites: () => '/sites',
  portfolioToday: () => '/portfolio/today',
  siteSummary: (siteId: string) => `/sites/${enc(siteId)}/summary`,
  siteDevices: (siteId: string) => `/sites/${enc(siteId)}/devices`,
  sitePowerDay: (siteId: string) => `/sites/${enc(siteId)}/power`,
  siteEnergyDaily: (siteId: string) => `/sites/${enc(siteId)}/energy/daily`,
  siteKpiDaily: (siteId: string) => `/sites/${enc(siteId)}/kpi/daily`,
  siteAlarms: (siteId: string) => `/sites/${enc(siteId)}/alarms`,
  deviceLive: (siteId: string, deviceId: string) => `/sites/${enc(siteId)}/devices/${enc(deviceId)}/live`,
  timeseries: (siteId: string) => `/sites/${enc(siteId)}/timeseries`,
  kpi: (siteId: string) => `/sites/${enc(siteId)}/kpi`,

  /* settings */
  device: (siteId: string, deviceId: string) => `/sites/${enc(siteId)}/devices/${enc(deviceId)}`,
  rates: (siteId: string, kind: string) => `/sites/${enc(siteId)}/rates/${enc(kind)}`,
  rate: (siteId: string, kind: string, from: string) => `/sites/${enc(siteId)}/rates/${enc(kind)}/${enc(from)}`,
  offsets: (siteId: string) => `/sites/${enc(siteId)}/energy-offsets`,
  offset: (siteId: string, deviceId: string, from: string) => `/sites/${enc(siteId)}/energy-offsets/${enc(deviceId)}/${enc(from)}`,
  profile: () => '/account/profile',
  password: () => '/account/password',
  company: () => '/account/company',
  recipients: () => '/account/alarm-recipients',
  recipient: (id: string) => `/account/alarm-recipients/${enc(id)}`,
  roles: () => '/account/roles',
  role: (id: string) => `/account/roles/${enc(id)}`,
  users: () => '/account/users',
  user: (id: string) => `/account/users/${enc(id)}`,
  userStatus: (id: string) => `/account/users/${enc(id)}/status`,
  userRole: (id: string) => `/account/users/${enc(id)}/role`,
};
