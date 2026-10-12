/* THE TAG VOCABULARY - what a device can be asked for, in what unit, and which
   kinds of device report which tags. Monitoring and Analysis read the same
   list, so a tag named on one page is the same tag on the other.

   This is configuration, not data: it says what questions are worth asking,
   not what the answers are. The tag names are the HMI's (P_AC, S_AC, GHI...);
   if the backend names a tag differently, translate it in api/adapters.ts
   rather than renaming it on every screen. */

export interface Param { tag: string; unit: string; label: string }

/** Analysis: category narrows, value picks. */
export const CATEGORIES: { k: string; vals: Param[] }[] = [
  { k: 'AC Power', vals: [p('P_AC', 'kW', 'Active Power'), p('S_AC', 'kVA', 'Apparent Power'), p('Q_AC', 'kVAR', 'Reactive Power'), p('COS_PHI', '', 'Power Factor')] },
  { k: 'AC Electrical', vals: [p('V_AC', 'V', 'AC Voltage'), p('I_AC', 'A', 'AC Current'), p('F_AC', 'Hz', 'Frequency')] },
  { k: 'DC Input', vals: [p('P_DC', 'kW', 'DC Power'), p('V_DC', 'V', 'DC Voltage'), p('I_DC', 'A', 'DC Current')] },
  { k: 'Energy', vals: [p('E_TODAY', 'kWh', 'Energy Today'), p('E_TOTAL', 'kWh', 'Total Energy')] },
  { k: 'Temperature', vals: [p('T_INT', '°C', 'Internal Temperature'), p('T_MOD', '°C', 'Module Temperature'), p('T_AMB', '°C', 'Ambient Temperature')] },
  { k: 'Irradiance', vals: [p('GHI', 'W/m²', 'GHI'), p('POA', 'W/m²', 'POA Irradiance')] },
  { k: 'Performance', vals: [p('PR', '%', 'Performance Ratio'), p('CUF', '%', 'Capacity Factor'), p('SPEC_YIELD', 'kWh/kWp', 'Specific Yield')] },
];

const EXTRA: Param[] = [p('T_OIL', '°C', 'Oil Temperature')];
const ALL: Param[] = [...CATEGORIES.flatMap(c => c.vals), ...EXTRA];

export const paramOf = (tag: string): Param | undefined => ALL.find(x => x.tag === tag);
export const unitOf = (tag: string): string => paramOf(tag)?.unit ?? '';
/** "P_AC (kW)" - bracketed and plain, so it survives a CSV opened in Excel */
export const labelWithUnit = (tag: string): string => { const u = unitOf(tag); return tag + (u ? ' (' + u + ')' : ''); };

/** Which tags each kind of device reports. A weather station has no power
 *  factor and an inverter has no irradiance: a device is never offered a tag it
 *  cannot answer. */
export const REPORTS: Record<string, string[]> = {
  INV: ['P_AC', 'S_AC', 'Q_AC', 'COS_PHI', 'V_AC', 'I_AC', 'F_AC', 'P_DC', 'V_DC', 'I_DC', 'E_TODAY', 'E_TOTAL', 'T_INT', 'PR', 'CUF', 'SPEC_YIELD'],
  MFM: ['P_AC', 'S_AC', 'Q_AC', 'COS_PHI', 'V_AC', 'I_AC', 'F_AC', 'E_TODAY', 'E_TOTAL'],
  WMS: ['T_MOD', 'T_AMB', 'GHI', 'POA'],
  TRF: ['P_AC', 'V_AC', 'I_AC', 'T_OIL'],
};
export const reports = (kind: string, tag: string) => (REPORTS[kind] ?? []).includes(tag);

/** Monitoring's device types, in the bar's order, and the data points each
 *  offers - in the HMI's own order (AC Output, then AC Current), so an engineer
 *  who reads the panel on site finds them in the same sequence here. */
export const DEVICE_TYPES: { label: string; kind: string; points: string[] }[] = [
  { label: 'Inverter', kind: 'INV', points: ['P_AC', 'S_AC', 'Q_AC', 'COS_PHI', 'F_AC', 'I_AC'] },
  { label: 'MFM', kind: 'MFM', points: ['P_AC', 'S_AC', 'Q_AC', 'COS_PHI', 'F_AC', 'I_AC', 'V_AC'] },
  { label: 'Weather station', kind: 'WMS', points: ['GHI', 'POA', 'T_AMB', 'T_MOD'] },
  { label: 'Transformer', kind: 'TRF', points: ['P_AC', 'V_AC', 'I_AC', 'T_OIL'] },
];

function p(tag: string, unit: string, label: string): Param { return { tag, unit, label }; }
