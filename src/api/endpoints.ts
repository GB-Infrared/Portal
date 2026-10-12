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

  /* sites */
  sites: () => '/sites',
  siteSummary: (siteId: string) => `/sites/${enc(siteId)}/summary`,
  siteDevices: (siteId: string) => `/sites/${enc(siteId)}/devices`,
  sitePowerDay: (siteId: string) => `/sites/${enc(siteId)}/power`,
  siteEnergyDaily: (siteId: string) => `/sites/${enc(siteId)}/energy/daily`,
  siteKpiDaily: (siteId: string) => `/sites/${enc(siteId)}/kpi/daily`,
  siteAlarms: (siteId: string) => `/sites/${enc(siteId)}/alarms`,
  deviceLive: (siteId: string, deviceId: string) => `/sites/${enc(siteId)}/devices/${enc(deviceId)}/live`,
  timeseries: (siteId: string) => `/sites/${enc(siteId)}/timeseries`,
};
