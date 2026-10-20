import * as api from '../../api/portal';
import type { CatalogModel, DeviceCategory, Metric, WaCustomer, WaDevice, WaLogger, WaPlant, WaPlantInput } from '../../api/types';
import { useToast } from '../../components/Toasts';
import { useApi, type ApiState } from '../../hooks/useApi';
import { MON } from '../../lib/format';
import { I_PLUS, useAsk, why } from '../settings/common';
import type { SsOpt } from '../settings/SsSelect';
import { av, sv, useForm, type Field, type Vals } from './Form';
import { also, dash, Filt, Grid, RowActs } from './Grid';

export interface Filters { cust: string; plant: string; logger: string; model: string }
export interface Can {
  customers: boolean; addCustomer: boolean; editCustomer: boolean; deleteCustomer: boolean;
  manageUsers: boolean; manageRoles: boolean; plant: (p: WaPlant | null | undefined) => boolean; plantLevel: boolean;
}
export interface Ctx {
  can: Can;
  customers: ApiState<WaCustomer[]>;
  plants: ApiState<WaPlant[]>;
  loggers: ApiState<WaLogger[]>;
  models: ApiState<CatalogModel[]>;
  F: Filters;
  setF: (p: Partial<Filters>) => void;
}

const CAT_NAME: Record<DeviceCategory, string> = { Inverter: 'Inverter', MFM: 'Meter', WMS: 'Weather station' };
const CAT_CODE: Record<DeviceCategory, string> = { Inverter: 'inverter', MFM: 'meter', WMS: 'wms' };
const typeOf = (d: CatalogModel) => CAT_CODE[d.category] + '_' + d.model.toLowerCase().replace(/\s+/g, '');
function above(ctx: Ctx, depth: 1 | 2 | 3): { gate: ApiState<unknown> | null; what?: string; empty: string | null } {
  if (!ctx.customers.data) return { gate: ctx.customers, what: 'customers', empty: null };
  if (!ctx.F.cust) return { gate: null, empty: ctx.customers.data.length ? ' ' : 'No customers yet' };
  if (depth < 2) return { gate: null, empty: null };
  if (!ctx.plants.data) return { gate: ctx.plants, what: 'plants', empty: null };
  if (!ctx.F.plant) return { gate: null, empty: ctx.plants.data.length ? ' ' : 'Add a plant for this customer first' };
  if (depth < 3) return { gate: null, empty: null };
  if (!ctx.loggers.data) return { gate: ctx.loggers, what: 'loggers', empty: null };
  if (!ctx.F.logger) return { gate: null, empty: ctx.loggers.data.length ? ' ' : 'Add a logger to this plant first' };
  return { gate: null, empty: null };
}
const custOpts = (list: WaCustomer[] | null) => (list ?? []).map(c => ({ v: c.id, t: c.name, s: c.id }));

const CU_FIELDS: Field[] = [
  { sec: 'Customer admin' },
  { k: 'first', label: 'First name' }, { k: 'last', label: 'Last name' },
  { k: 'amail', label: 'Admin email', type: 'email', span: true, hint: 'They sign in to the customer admin panel with this.' },
  { sec: 'Company' },
  { k: 'name', label: 'Name', hint: 'What the customer panel calls them.' }, { k: 'legal', label: 'Legal name' },
  { k: 'cmail', label: 'Company email', type: 'email' }, { k: 'phone', label: 'Contact number', type: 'tel' },
  { k: 'addr', label: 'Address', type: 'area', span: true },
];
const customerInput = (v: Vals): api.WaCustomerInput => ({
  adminFirst: sv(v, 'first'), adminLast: sv(v, 'last'), adminEmail: sv(v, 'amail'), name: sv(v, 'name'), legalName: sv(v, 'legal'),
  companyEmail: sv(v, 'cmail'), phone: sv(v, 'phone'), address: sv(v, 'addr'),
});

export function CustomersPane({ on, ctx }: { on: boolean; ctx: Ctx }) {
  const toast = useToast(), ask = useAsk();
  const [dialog, setForm] = useForm();
  const list = ctx.customers.data;
  const clash = (v: Vals, self: WaCustomer | null): [string, string] | null =>
    (list ?? []).some(c => c !== self && c.adminEmail.toLowerCase() === sv(v, 'amail').toLowerCase()) ? ['amail', 'That admin already runs another customer.'] : null;
  const add = () => setForm({
    title: 'Add customer', go: 'Add customer', wide: 'w600', fields: CU_FIELDS, check: v => clash(v, null),
    save: async v => { await api.waSaveCustomer(null, customerInput(v)); ctx.customers.reload(); return sv(v, 'name') + ' added'; },
  });
  const edit = (c: WaCustomer) => setForm({
    title: 'Edit customer', go: 'Save changes', wide: 'w600', fields: CU_FIELDS, who: [['Id', c.id]], check: v => clash(v, c),
    values: { first: c.adminFirst, last: c.adminLast, amail: c.adminEmail, name: c.name, legal: c.legalName, cmail: c.companyEmail, phone: c.phone, addr: c.address },
    save: async v => { await api.waSaveCustomer(c.id, customerInput(v)); ctx.customers.reload(); return sv(v, 'name') + ' updated'; },
  });
  const del = (c: WaCustomer) => ask({
    title: 'Delete customer', rows: [['Customer', c.name], ['Admin', c.adminEmail]],
    text: 'The customer and their admin account are removed. Their admin can no longer sign in to the customer admin panel.' + also(c.plantCount, c.loggerCount, c.deviceCount),
    go: 'Delete customer',
    then: async () => { try { await api.waRemoveCustomer(c.id); ctx.customers.reload(); toast(c.name + ' deleted'); } catch (x) { toast('Could not delete: ' + why(x), true); } },
  });
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-customers">
      <div className="chead"><div className="tools">
        {ctx.can.addCustomer && <button className="tbtn add" type="button" id="cu-add" disabled={!list} onClick={add}>{I_PLUS}ADD CUSTOMER</button>}
      </div></div>
      <Grid what="customers" state={ctx.customers} rows={list} empty="No customers yet"
            cols={[{ t: 'Id' }, { t: 'Name' }, { t: 'Legal name' }, { t: 'Company email' }, { t: 'Contact number' }, { t: 'Admin email' }, { t: 'Address' }, { t: 'Plants', num: true }, { t: '' }]}
            row={c => (
              <tr key={c.id}>
                <td className="mono">{c.id}</td><td className="nm">{c.name}</td><td>{c.legalName}</td><td>{c.companyEmail}</td>
                <td>{dash(c.phone)}</td><td>{c.adminEmail}</td><td className="wrap">{c.address}</td><td className="num">{dash(c.plantCount)}</td>
                <td><RowActs onEdit={ctx.can.editCustomer ? () => edit(c) : undefined} onDel={ctx.can.deleteCustomer ? () => del(c) : undefined} /></td>
              </tr>
            )} />
      {dialog}
    </section>
  );
}

const METRICS: [Metric, string][] = [['pr', 'Performance Ratio'], ['cuf', 'CUF'], ['grid', 'Grid Availability'], ['plant', 'Plant Availability'], ['yield', 'Specific Yield'], ['loss', 'Energy Loss']];
const FIXED_PAGES = ['Home', 'Monitoring', 'Alarms'], CHOICE_PAGES = ['Analysis', 'KPI'];
const SOURCE: SsOpt[] = [{ v: 'inverter', t: 'Inverter' }, { v: 'meter', t: 'Meter' }];
const YESNO: SsOpt[] = [{ v: 'no', t: 'No' }, { v: 'yes', t: 'Yes' }];
const KPI_OPTS: SsOpt[] = METRICS.map(([v, t]) => ({ v, t }));
const TIMEZONES: SsOpt[] = [['Asia/Kolkata', 'Asia/Kolkata (UTC+05:30)'], ['Asia/Dubai', 'Asia/Dubai (UTC+04:00)'], ['Asia/Singapore', 'Asia/Singapore (UTC+08:00)'],
  ['Africa/Nairobi', 'Africa/Nairobi (UTC+03:00)'], ['Europe/London', 'Europe/London (UTC+00:00)'], ['America/New_York', 'America/New_York (UTC-05:00)'],
  ['Australia/Sydney', 'Australia/Sydney (UTC+10:00)']].map(([v, t]) => ({ v, t }));
const HPDS: ['power' | 'energy' | 'gen', string, string][] = [
  ['power', 'Plant Power source', 'Plant Power graph and the Plant Power value in Plant Details.'],
  ['energy', 'Plant Energy source', 'Plant Energy value in Plant Details.'],
  ['gen', 'Energy Generation source', 'Plant Energy Generation graph (daily e-diff).'],
];

function plantFields(customers: SsOpt[], meters: SsOpt[], wms: SsOpt[]): Field[] {
  const meterWord = meters.length ? 'Select' : 'No meters found';
  const f: Field[] = [
    { k: 'cust', label: 'Select Customer', type: 'select', any: 'Select', opts: customers },
    { k: 'name', label: 'Name', newRow: true },
    { k: 'id', label: 'Asset ID', type: 'ro', hint: 'Made automatically.' },
    { k: 'area', label: 'Area' }, { k: 'city', label: 'City' },
    { k: 'state', label: 'State' }, { k: 'country', label: 'Country', def: 'India' }, { k: 'zip', label: 'Zip' },
    { k: 'lat', label: 'Latitude', type: 'number' },
    { k: 'lng', label: 'Longitude', type: 'number' }, { k: 'addr', label: 'Address' },
    { k: 'desc', label: 'Asset Description', opt: true },
    { k: 'ac', label: 'AC Capacity (kW)', type: 'number', min: 0 },
    { k: 'dc', label: 'DC Capacity (kWp)', type: 'number', min: 0 },
    { k: 'pstc', label: 'PSTC (kWp)', type: 'number', min: 0 },
    { k: 'mod', label: 'Modules Power Rating (Wp)', type: 'number', min: 0 },
    { k: 'minIrr', label: 'Minimum Irradiance (W/m²)', type: 'number', min: 0 },
    { k: 'inst', label: 'Installation Date', type: 'date' },
    { k: 'sensors', label: 'Irradiation Sensor', type: 'multi', opts: wms, opt: true, any: 'Select', none: 'No weather station on this plant' },
    { k: 'pages', label: 'Page Access', type: 'multi', opts: CHOICE_PAGES.map(p => ({ v: p, t: p })), def: CHOICE_PAGES, any: 'None', opt: true,
      hint: 'Home, Monitoring and Alarms are always on.' },
    { k: 'irr', label: 'Irradiance', type: 'select', def: 'inclined', opts: [{ v: 'inclined', t: 'Inclined (POA)' }, { v: 'horizontal', t: 'Horizontal (GHI)' }] },
    { k: 'tz', label: 'Select Timezone', type: 'select', def: 'Asia/Kolkata', opts: TIMEZONES, w: 2 },
    { sec: 'Home Page Data Source' },
  ];
  for (const [k, label, hint] of HPDS) {
    f.push({ k: 'hs_' + k, label, type: 'select', def: 'inverter', opts: SOURCE, hint },
      { k: 'hm_' + k, label: 'Meter', type: 'select', opts: meters, any: meterWord, show: v => sv(v, 'hs_' + k) === 'meter', hint: 'One meter of this plant.' });
  }
  f.push({ sec: 'Energy Source Selection For Metrics' },
    { k: 'src', label: 'Energy Source', type: 'select', def: 'inverter', opts: SOURCE },
    { k: 'meter', label: 'Meter', type: 'select', opts: meters, any: meterWord, show: v => sv(v, 'src') === 'meter' });
  for (const [m, label] of METRICS) f.push({ k: 'm_' + m, label, type: 'select', opts: meters, any: meterWord, opt: true });
  f.push({ sec: 'KPI Configuration' },
    { k: 'kpiHome', label: 'Default Home Page KPI', type: 'select', def: 'pr', opts: KPI_OPTS },
    { k: 'ckpi', label: 'Configure KPI', type: 'select', def: 'pr', opts: KPI_OPTS, newRow: true });
  for (const [m] of METRICS) {
    const mine = (v: Vals) => sv(v, 'ckpi') === m;
    f.push({ k: 'kb_' + m, label: 'Show Barchart', type: 'select', def: 'no', opts: YESNO, show: mine, hide: true },
      { k: 'ka_' + m, label: 'Auxiliary Supply Meter Available', type: 'select', def: 'no', opts: YESNO, show: mine, hide: true },
      { k: 'kp_' + m, label: 'Energy at POI Meter Available', type: 'select', def: 'no', opts: YESNO, show: mine, hide: true });
  }
  return f;
}

const dayText = (iso: string | null) => { const q = (iso ?? '').slice(0, 10).split('-'); return q.length === 3 ? q[2] + ' ' + MON[+q[1] - 1] + ' ' + q[0] : '—'; };
const numText = (n: number | null) => (n === null ? '' : String(n));
const numOf = (s: string) => (s.trim() === '' || !Number.isFinite(+s) ? null : +s);
const yn = (b: boolean) => (b ? 'yes' : 'no');

function plantValues(p: WaPlant): Vals {
  const v: Vals = {
    cust: p.customerId, name: p.name, id: p.id, area: p.area, city: p.city, state: p.state, country: p.country, zip: p.zip,
    lat: numText(p.lat), lng: numText(p.lng), addr: p.address, desc: p.description,
    ac: numText(p.acKw), dc: numText(p.dcKwp), pstc: numText(p.pstcKwp), mod: numText(p.moduleWp), minIrr: numText(p.minIrradiance),
    inst: p.installedOn ?? '', sensors: p.irradiationSensors, pages: p.pages.filter(x => CHOICE_PAGES.includes(x)),
    irr: p.irradiance, tz: p.timezone, src: p.energySource.source, meter: p.energySource.meter, kpiHome: p.homeKpi, ckpi: p.homeKpi,
    hs_power: p.homeSources.power.source, hm_power: p.homeSources.power.meter,
    hs_energy: p.homeSources.energy.source, hm_energy: p.homeSources.energy.meter,
    hs_gen: p.homeSources.generation.source, hm_gen: p.homeSources.generation.meter,
  };
  for (const [m] of METRICS) {
    v['m_' + m] = p.metricMeters[m];
    v['kb_' + m] = yn(p.kpi[m].bar); v['ka_' + m] = yn(p.kpi[m].aux); v['kp_' + m] = yn(p.kpi[m].poi);
  }
  return v;
}

function plantInput(v: Vals): WaPlantInput {
  const pickOf = (k: string) => {
    const meter = sv(v, 'hs_' + k) === 'meter';
    return { source: meter ? 'meter' as const : 'inverter' as const, meter: meter ? sv(v, 'hm_' + k) : '' };
  };
  const src = sv(v, 'src') === 'meter';
  return {
    customerId: sv(v, 'cust'), name: sv(v, 'name'), area: sv(v, 'area'), city: sv(v, 'city'), state: sv(v, 'state'), country: sv(v, 'country'), zip: sv(v, 'zip'),
    lat: numOf(sv(v, 'lat')), lng: numOf(sv(v, 'lng')), address: sv(v, 'addr'), description: sv(v, 'desc'),
    acKw: numOf(sv(v, 'ac')), dcKwp: numOf(sv(v, 'dc')), pstcKwp: numOf(sv(v, 'pstc')), moduleWp: numOf(sv(v, 'mod')), minIrradiance: numOf(sv(v, 'minIrr')),
    installedOn: sv(v, 'inst') || null, irradiationSensors: av(v, 'sensors'),
    pages: [...FIXED_PAGES, ...CHOICE_PAGES.filter(p => av(v, 'pages').includes(p))],
    irradiance: sv(v, 'irr') === 'horizontal' ? 'horizontal' : 'inclined', timezone: sv(v, 'tz'),
    energySource: { source: src ? 'meter' : 'inverter', meter: src ? sv(v, 'meter') : '' },
    metricMeters: Object.fromEntries(METRICS.map(([m]) => [m, sv(v, 'm_' + m)])) as Record<Metric, string>,
    homeKpi: (sv(v, 'kpiHome') || 'pr') as Metric,
    kpi: Object.fromEntries(METRICS.map(([m]) => [m, { bar: sv(v, 'kb_' + m) === 'yes', aux: sv(v, 'ka_' + m) === 'yes', poi: sv(v, 'kp_' + m) === 'yes' }])) as WaPlantInput['kpi'],
    homeSources: { power: pickOf('power'), energy: pickOf('energy'), generation: pickOf('gen') },
  };
}

export function PlantsPane({ on, ctx }: { on: boolean; ctx: Ctx }) {
  const toast = useToast(), ask = useAsk();
  const [dialog, setForm] = useForm();
  const list = ctx.plants.data;
  const customers = custOpts(ctx.customers.data);
  const up = above(ctx, 1);
  const catOf = (d: WaDevice) => ctx.models.data?.find(m => m.id === d.modelId)?.category;
  const add = () => setForm({
    title: 'Add plant', go: 'Add plant', wide: 'w1100', cols: 4, fields: plantFields(customers, [], []),
    values: { cust: ctx.F.cust, id: 'Made when saved' },
    save: async v => { await api.waSavePlant(null, plantInput(v)); ctx.setF({ cust: sv(v, 'cust') }); ctx.plants.reload(); return sv(v, 'name') + ' added'; },
  });
  const edit = async (p: WaPlant) => {
    let devs: WaDevice[] = [];
    try { devs = await api.waGetDevices({ plantId: p.id }); } catch (x) { toast('Could not load this plant\'s devices: ' + why(x), true); }
    const of = (c: DeviceCategory) => devs.filter(d => catOf(d) === c);
    setForm({
      title: 'Edit plant', go: 'Save changes', wide: 'w1100', cols: 4, values: plantValues(p),
      fields: plantFields(customers, of('MFM').map(d => ({ v: d.name, t: d.name, s: d.id })), of('WMS').map(d => ({ v: d.name, t: d.name }))),
      save: async v => { await api.waSavePlant(p.id, plantInput(v)); ctx.plants.reload(); return sv(v, 'name') + ' updated'; },
    });
  };
  const del = (p: WaPlant) => ask({
    title: 'Delete plant', rows: [['Plant', p.name], ['Customer', ctx.customers.data?.find(c => c.id === p.customerId)?.name ?? '']],
    text: 'The plant is removed from the customer admin panel.' + also(0, p.loggerCount, p.deviceCount), go: 'Delete plant',
    then: async () => { try { await api.waRemovePlant(p.id); ctx.plants.reload(); toast(p.name + ' deleted'); } catch (x) { toast('Could not delete: ' + why(x), true); } },
  });
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-assets">
      <div className="chead"><div className="tools">
        {!!customers.length && <button className="tbtn add" type="button" id="as-add" onClick={add}>{I_PLUS}ADD PLANT</button>}
      </div></div>
      <div className="filters"><Filt id="fl-assets-cust" label="Customer" value={ctx.F.cust} options={customers} onPick={cust => ctx.setF({ cust })} /></div>
      <Grid what={up.what ?? 'plants'} state={up.gate ?? ctx.plants} rows={up.gate ? null : up.empty ? [] : list} empty={up.empty ?? 'No plants for this customer yet'}
            cols={[{ t: 'Asset ID' }, { t: 'Name' }, { t: 'Area' }, { t: 'City' }, { t: 'State' }, { t: 'Country' }, { t: 'Zip' }, { t: 'Lat / Lng' }, { t: 'AC kW', num: true }, { t: 'DC kWp', num: true }, { t: 'Energy source' }, { t: 'Installed' }, { t: '' }]}
            row={p => (
              <tr key={p.id}>
                <td className="mono">{p.id}</td><td className="nm">{p.name}</td><td>{p.area}</td><td>{p.city}</td><td>{p.state}</td><td>{p.country}</td>
                <td className="mono">{p.zip}</td><td className="mono">{dash(p.lat)}, {dash(p.lng)}</td>
                <td className="num">{dash(p.acKw)}</td><td className="num">{dash(p.dcKwp)}</td>
                <td>{p.energySource.source === 'meter' ? 'Meter · ' + p.energySource.meter : 'Inverter'}</td>
                <td className="mono">{dayText(p.installedOn)}</td>
                <td>{ctx.can.plant(p) && <RowActs onEdit={() => { void edit(p); }} onDel={() => del(p)} />}</td>
              </tr>
            )} />
      {dialog}
    </section>
  );
}

const LG_FIELDS: Field[] = [{ k: 'name', label: 'Logger name', span: true }, { k: 'desc', label: 'Description', type: 'area', span: true, opt: true }];

function PlaceFilters({ ctx, page, upTo }: { ctx: Ctx; page: string; upTo: 'plant' | 'logger' }) {
  return (
    <div className="filters">
      <Filt id={'fl-' + page + '-cust'} label="Customer" value={ctx.F.cust} options={custOpts(ctx.customers.data)} onPick={cust => ctx.setF({ cust })} />
      <Filt id={'fl-' + page + '-asset'} label="Plant" value={ctx.F.plant} options={(ctx.plants.data ?? []).map(p => ({ v: p.id, t: p.name, s: p.id }))} onPick={plant => ctx.setF({ plant })} />
      {upTo === 'logger' && <Filt id={'fl-' + page + '-logger'} label="Logger" value={ctx.F.logger} options={(ctx.loggers.data ?? []).map(l => ({ v: l.id, t: l.name, s: l.id }))} onPick={logger => ctx.setF({ logger })} />}
    </div>
  );
}

export function LoggersPane({ on, ctx }: { on: boolean; ctx: Ctx }) {
  const toast = useToast(), ask = useAsk();
  const [dialog, setForm] = useForm();
  const plant = ctx.plants.data?.find(p => p.id === ctx.F.plant) ?? null;
  const up = above(ctx, 2);
  const mine = ctx.can.plant(plant);
  const custName = ctx.customers.data?.find(c => c.id === ctx.F.cust)?.name ?? '';
  const who = (): [string, string][] => [['Customer', custName], ['Plant', plant?.name ?? '']];
  const add = () => {
    if (!plant) { toast('Add a plant for this customer first'); return; }
    setForm({ title: 'Add logger', go: 'Add logger', who: who(), fields: LG_FIELDS,
      save: async v => { await api.waSaveLogger(null, { plantId: plant.id, name: sv(v, 'name'), description: sv(v, 'desc') }); ctx.loggers.reload(); return sv(v, 'name') + ' added'; } });
  };
  const edit = (l: WaLogger) => setForm({
    title: 'Edit logger', go: 'Save changes', who: [...who(), ['Logger ID', l.id]], fields: LG_FIELDS, values: { name: l.name, desc: l.description },
    save: async v => { await api.waSaveLogger(l.id, { plantId: l.plantId, name: sv(v, 'name'), description: sv(v, 'desc') }); ctx.loggers.reload(); return sv(v, 'name') + ' updated'; },
  });
  const del = (l: WaLogger) => ask({
    title: 'Delete logger', rows: [['Logger', l.name], ['Id', l.id]], text: 'The logger is removed from this plant.' + also(0, 0, l.deviceCount), go: 'Delete logger',
    then: async () => { try { await api.waRemoveLogger(l.id); ctx.loggers.reload(); toast(l.name + ' deleted'); } catch (x) { toast('Could not delete: ' + why(x), true); } },
  });
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-loggers">
      <div className="chead"><div className="tools">
        {(!ctx.can.plantLevel || mine) && <button className="tbtn add" type="button" id="lg-add" disabled={!!up.gate} onClick={add}>{I_PLUS}ADD LOGGER</button>}
      </div></div>
      <PlaceFilters ctx={ctx} page="loggers" upTo="plant" />
      <Grid what={up.what ?? 'loggers'} state={up.gate ?? ctx.loggers} rows={up.gate ? null : up.empty ? [] : ctx.loggers.data} empty={up.empty ?? 'No loggers on this plant yet'}
            cols={[{ t: 'Logger ID' }, { t: 'Logger name' }, { t: 'Description' }, { t: 'Devices', num: true }, { t: '' }]}
            row={l => (
              <tr key={l.id}>
                <td className="mono">{l.id}</td><td className="nm">{l.name}</td><td className="wrap">{dash(l.description)}</td><td className="num">{dash(l.deviceCount)}</td>
                <td>{mine && <RowActs onEdit={() => edit(l)} onDel={() => del(l)} />}</td>
              </tr>
            )} />
      {dialog}
    </section>
  );
}

export function DevicesPane({ on, ctx }: { on: boolean; ctx: Ctx }) {
  const toast = useToast(), ask = useAsk();
  const [dialog, setForm] = useForm();
  const devs = useApi(ctx.F.logger ? s => api.waGetDevices({ loggerId: ctx.F.logger }, { signal: s }) : null, [ctx.F.logger]);
  const plant = ctx.plants.data?.find(p => p.id === ctx.F.plant) ?? null;
  const logger = ctx.loggers.data?.find(l => l.id === ctx.F.logger) ?? null;
  const mine = ctx.can.plant(plant);
  const models = ctx.models.data ?? [];
  const modelOf = (id: string) => models.find(m => m.id === id);
  const fields: Field[] = [
    { k: 'cat', label: 'Device category', type: 'select', opts: (Object.keys(CAT_NAME) as DeviceCategory[]).map(c => ({ v: c, t: CAT_NAME[c] })), any: 'Choose a category' },
    { k: 'dev', label: 'Device name', type: 'select', any: 'Choose a model', hint: 'The model, from the Devices List.',
      opts: v => models.filter(d => !sv(v, 'cat') || d.category === sv(v, 'cat')).map(d => ({ v: d.id, t: d.name, s: d.mapping })) },
    { k: 'name', label: 'Customer device name', hint: 'The name the customer panel shows, e.g. INV01.' },
    { k: 'serial', label: 'Serial number', opt: true },
  ];
  const custName = ctx.customers.data?.find(c => c.id === ctx.F.cust)?.name ?? '';
  const who = (): [string, string][] => [['Customer', custName], ['Plant', plant?.name ?? ''], ['Logger', logger?.name ?? '']];
  const open = async (d: WaDevice | null) => {
    if (!logger) { toast(plant ? 'Add a logger to this plant first' : 'Add a plant for this customer first'); return; }
    let onPlant: WaDevice[] = [];
    try { onPlant = await api.waGetDevices({ plantId: plant?.id ?? '' }); } catch { onPlant = devs.data ?? []; }
    const check = (v: Vals): [string, string] | null => {
      if (onPlant.some(x => x.id !== d?.id && x.name.toLowerCase() === sv(v, 'name').toLowerCase())) return ['name', 'This plant already has a device called that.'];
      if (!sv(v, 'cat') || modelOf(sv(v, 'dev'))?.category !== sv(v, 'cat')) return ['dev', 'Choose a model in this category.'];
      return null;
    };
    const body = (v: Vals) => ({ loggerId: logger.id, modelId: sv(v, 'dev'), name: sv(v, 'name'), serial: sv(v, 'serial') });
    setForm(d ? {
      title: 'Edit device', go: 'Save changes', who: [...who(), ['Device ID', d.id]], fields, check,
      values: { cat: modelOf(d.modelId)?.category ?? '', dev: d.modelId, name: d.name, serial: d.serial },
      save: async v => { await api.waSaveDevice(d.id, body(v)); devs.reload(); return sv(v, 'name') + ' updated'; },
    } : {
      title: 'Add device', go: 'Add device', who: who(), fields, check,
      save: async v => { await api.waSaveDevice(null, body(v)); devs.reload(); ctx.loggers.reload(); return sv(v, 'name') + ' added'; },
    });
  };
  const del = (d: WaDevice) => ask({
    title: 'Delete device', rows: [['Device', d.name], ['Id', d.id]], text: 'The device leaves this plant. Its readings stop appearing on the customer panel.', go: 'Delete device',
    then: async () => { try { await api.waRemoveDevice(d.id); devs.reload(); ctx.loggers.reload(); toast(d.name + ' deleted'); } catch (x) { toast('Could not delete: ' + why(x), true); } },
  });
  const up = above(ctx, 3);
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-cdevices">
      <div className="chead"><div className="tools">
        {(!ctx.can.plantLevel || mine) && <button className="tbtn add" type="button" id="cd-add" disabled={!!up.gate} onClick={() => { void open(null); }}>{I_PLUS}ADD DEVICE</button>}
      </div></div>
      <PlaceFilters ctx={ctx} page="cdevices" upTo="logger" />
      <Grid what={up.what ?? 'devices'} state={up.gate ?? devs} rows={up.gate ? null : up.empty ? [] : devs.data} empty={up.empty ?? 'No devices on this logger yet'}
            cols={[{ t: 'Device ID' }, { t: 'Customer device name' }, { t: 'Device name' }, { t: 'Category' }, { t: 'Serial number' }, { t: '' }]}
            row={d => {
              const m = modelOf(d.modelId);
              return (
                <tr key={d.id}>
                  <td className="mono">{d.id}</td><td className="nm">{d.name}</td><td>{m?.name ?? ''}</td><td>{m ? CAT_NAME[m.category] : ''}</td>
                  <td className="mono">{dash(d.serial)}</td><td>{mine && <RowActs onEdit={() => { void open(d); }} onDel={() => del(d)} />}</td>
                </tr>
              );
            }} />
      {dialog}
    </section>
  );
}

export function ModelsPane({ on, ctx }: { on: boolean; ctx: Ctx }) {
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-devices">
      <Grid what="device models" state={ctx.models} rows={ctx.models.data} empty="No device models"
            cols={[{ t: 'Device name' }, { t: 'Device ID' }, { t: 'Category' }, { t: 'Type' }, { t: 'Mapping version' }]}
            row={d => (
              <tr key={d.id}><td className="nm">{d.name}</td><td className="mono">{d.id}</td><td>{CAT_NAME[d.category]}</td>
                <td className="mono">{typeOf(d)}</td><td className="mono">{d.mapping}</td></tr>
            )} />
    </section>
  );
}

export function SensorsPane({ on, ctx }: { on: boolean; ctx: Ctx }) {
  const sensors = useApi(ctx.F.model ? s => api.waGetSensors(ctx.F.model, { signal: s }) : null, [ctx.F.model]);
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-sensors">
      <div className="filters">
        <Filt id="fl-sensors-sdev" label="Device" value={ctx.F.model} options={(ctx.models.data ?? []).map(d => ({ v: d.id, t: d.name, s: CAT_NAME[d.category] }))} onPick={model => ctx.setF({ model })} />
      </div>
      <Grid what={ctx.models.data ? 'sensors' : 'device models'} state={ctx.models.data ? sensors : ctx.models} rows={!ctx.models.data ? null : ctx.F.model ? sensors.data : []}
            empty={ctx.F.model ? 'No data points for this device' : 'No device models'}
            cols={[{ t: 'Sensor name' }, { t: 'Field code' }, { t: 'Variable name' }, { t: 'Unit' }, { t: 'Category' }]}
            row={s => (
              <tr key={s.tag + s.code}><td className="nm">{s.name}</td><td className="mono">{s.code}</td><td className="mono">{s.tag}</td><td>{dash(s.unit)}</td><td>{s.category}</td></tr>
            )} />
    </section>
  );
}
