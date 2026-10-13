import { useState } from 'react';
import * as api from '../../api/portal';
import type { Device, EnergyOffset, RateKind, RatePeriod, Site } from '../../api/types';
import { DataGate } from '../../components/DataState';
import { useToast } from '../../components/Toasts';
import { useApi } from '../../hooks/useApi';
import { check, Fld, Modal, type Errs } from './Modal';
import { SsSelect } from './SsSelect';
import { addedStamp, asDate, dayBefore, fmtDate, I_BIN, I_PEN, I_PLUS, Pill, plusDay, Rowbtn, SitePin, today0, todayIso, useAsk, why } from './common';

const TYPE: Record<string, string> = { INV: 'Inverter', MFM: 'MFM', WMS: 'Weather station', TRF: 'Transformer' };
const typeOf = (d: Device) => TYPE[d.kind] ?? d.kind;
const byName = (a: Device, b: Device) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function DevicesPane({ on, site }: { on: boolean; site: Site }) {
  const toast = useToast();
  const dv = useApi(s => api.getSiteDevices(site.id, { signal: s }), [site.id]);
  const [per, setPer] = useState('25');
  const [pg, setPg] = useState(0);
  const [rn, setRn] = useState<Device | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = (dv.data ?? []).slice().sort(byName);
  const n = +per, pages = Math.max(1, Math.ceil(rows.length / n)), page = Math.min(pg, pages - 1);
  const from = page * n, slice = rows.slice(from, from + n);
  const gone = rows.filter(d => d.retired).length;

  const save = async () => {
    if (!rn) return;
    const v = name.trim();
    if (!v) { setErr('A device needs a name.'); return; }
    if (rows.some(x => x.id !== rn.id && x.name.toLowerCase() === v.toLowerCase())) { setErr(site.name + ' already has a device called that.'); return; }
    setBusy(true);
    try { await api.renameDevice(site.id, rn.id, v); setRn(null); dv.reload(); toast('Renamed to ' + v); }
    catch (x) { setErr(why(x)); }
    finally { setBusy(false); }
  };

  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-customer-devices">
      <div className="chead">
        <div className="title">Customer Devices</div>
        <div className="tools">
          <SitePin name={site.name} />
          <span className="count">{dv.data ? rows.length + ' device' + (rows.length === 1 ? '' : 's') + (gone ? ' · ' + gone + ' retired' : '') : ''}</span>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Device</th><th>Id</th><th>Type</th><th>Commissioned</th><th>Status</th><th /></tr></thead>
          <tbody>
            {!dv.data ? <tr><td colSpan={6}><DataGate loading={dv.loading} error={dv.error} what="devices" onRetry={dv.reload} /></td></tr>
              : !slice.length ? <tr><td colSpan={6}><div className="empty-note">No devices on this site yet</div></td></tr>
              : slice.map(d => (
                <tr key={d.id} className={d.retired ? 'gone' : undefined}>
                  <td className="nm">{d.name}</td>
                  <td className="mono">{d.id}</td>
                  <td>{typeOf(d)}</td>
                  <td className="mono">{fmtDate(d.commissionedOn)}</td>
                  <td><Pill live={!d.retired} yes="Live" no="Retired" /></td>
                  <td><div className="rowacts"><Rowbtn title={'Rename ' + d.name} onClick={() => { setRn(d); setName(d.name); setErr(''); }}>{I_PEN}</Rowbtn></div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="tfoot">
        <span>Rows per page</span>
        <SsSelect className="mini perbtn" label="Rows per page" value={per}
                  options={['25', '50', '75', '100', '150', '200'].map(v => ({ v, t: v }))} onPick={v => { setPer(v); setPg(0); }} />
        <span className="sp" />
        <span className="range">{rows.length ? `${from + 1}-${Math.min(from + n, rows.length)} of ${rows.length}` : '0-0 of 0'}</span>
        <button className="pgbtn" type="button" disabled={page <= 0} onClick={() => setPg(page - 1)}>&lsaquo;</button>
        <button className="pgbtn" type="button" disabled={page >= pages - 1} onClick={() => setPg(page + 1)}>&rsaquo;</button>
      </div>

      {rn && (
        <Modal title="Rename device" onClose={() => setRn(null)} onSubmit={save}
               foot={<><button className="btn" type="button" onClick={() => setRn(null)}>Cancel</button>
                       <button className="btn primary" type="submit" disabled={busy}>Save name</button></>}>
          <div className="mwho">
            <div className="r"><b>Id</b><span>{rn.id}</span></div>
            <div className="r"><b>Plant</b><span>{site.name}</span></div>
            <div className="r"><b>Type</b><span>{typeOf(rn)}</span></div>
          </div>
          <Fld label="Device name" htmlFor="rn-name" err={err}>
            <input id="rn-name" type="text" maxLength={24} autoComplete="off" spellCheck={false} value={name} onChange={e => setName(e.target.value)} />
          </Fld>
          <div className="mtext">This is the name Monitoring, Alarms, the KPI table and Analysis will all show. The id above never changes, so history stays attached to it either way.</div>
        </Modal>
      )}
    </section>
  );
}

const RATE = {
  emission: { id: 'p-emission-rate', title: 'Emission Rate', noun: 'emission rate', head: <>kg CO&#8322; / kWh</>, unit: 'kg CO₂ per kWh', dp: 3, step: '0.001', ph: '0.727',
    hi: 5, hiSay: 'That looks like grams. This field is kg CO₂ per kWh.', empty: 'savings cannot be reported until there is one' },
  electricity: { id: 'p-electricity-rate', title: 'Electricity Rate', noun: 'electricity rate', head: <>&#8377; / kWh</>, unit: '₹ per kWh', dp: 2, step: '0.01', ph: '7.85',
    hi: 100, hiSay: 'That looks like paise. This field is ₹ per kWh.', empty: 'the savings figures have nothing to be priced against until there is one' },
};

export function RatePane({ on, site, kind }: { on: boolean; site: Site; kind: RateKind }) {
  const c = RATE[kind];
  const toast = useToast(), ask = useAsk();
  const r = useApi(s => api.getRates(site.id, kind, { signal: s }), [site.id, kind]);
  const list: RatePeriod[] = r.data ?? [];
  const last = list[list.length - 1];
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(''), [rate, setRate] = useState('');
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const v = parseFloat(rate);
    const e = check([
      ['rd-from', !from ? 'A rate needs a date it takes effect.'
        : last && asDate(from) <= asDate(last.from) ? 'Must be after ' + fmtDate(last.from) + ', the rate it replaces.'
        : asDate(from) > today0() && 'A rate takes effect from a date that has arrived, not a future one.'],
      ['rd-rate', !rate.trim() ? 'A rate is required.' : (isNaN(v) || v <= 0) ? 'A rate has to be greater than zero.' : v > c.hi && c.hiSay],
    ]);
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await api.addRate(site.id, kind, from, v); setOpen(false); r.reload(); toast('Rate added, active from ' + fmtDate(from)); }
    catch (x) { toast('Could not add the rate: ' + why(x), true); }
    finally { setBusy(false); }
  };
  const remove = (p: RatePeriod) => {
    const prev = list[list.length - 2];
    ask({
      title: 'Remove ' + c.noun,
      rows: [['Rate', p.rate.toFixed(c.dp)], ['Active from', fmtDate(p.from)], ['Site', site.name]],
      text: <>This is the rate <b>{site.name}</b> is being costed at now. {prev
        ? <>Removing it hands the period back to <b>{prev.rate.toFixed(c.dp)}</b>, active from {fmtDate(prev.from)}, and everything from {fmtDate(p.from)} onwards is re-costed at that number.</>
        : 'It is the only one on record, so removing it leaves the site with no rate at all and nothing to report savings against until another is added.'}</>,
      go: 'Remove rate',
      then: async () => {
        try { await api.removeRate(site.id, kind, p.from); r.reload(); toast('Rate dated ' + fmtDate(p.from) + ' removed'); }
        catch (x) { toast('Could not remove it: ' + why(x), true); }
      },
    });
  };

  return (
    <section className={'panel card' + (on ? ' on' : '')} id={c.id}>
      <div className="chead">
        <div className="title">{c.title}</div>
        <div className="tools">
          <SitePin name={site.name} />
          <button className="tbtn" type="button" disabled={!r.data} onClick={() => { setFrom(''); setRate(''); setErrs({}); setOpen(true); }}>{I_PLUS}ADD RATE</button>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>From</th><th>Until</th><th>Rate <span className="u">{c.head}</span></th><th>Status</th>
            <th title="When the row was entered, which is not when the rate took effect">Added</th><th /></tr></thead>
          <tbody>
            {!r.data ? <tr><td colSpan={6}><DataGate loading={r.loading} error={r.error} what={c.noun + 's'} onRetry={r.reload} /></td></tr>
              : !list.length ? <tr><td colSpan={6}><div className="empty-note">No {c.noun} set for {site.name} — {c.empty}</div></td></tr>
              : list.map((p, i) => {
                const live = i === list.length - 1;
                return (
                  <tr key={p.from}>
                    <td className="mono nm">{fmtDate(p.from)}</td>
                    <td className={'mono' + (live ? ' dim' : '')}>{live ? '—' : dayBefore(list[i + 1].from)}</td>
                    <td className="mono nm">{p.rate.toFixed(c.dp)}</td>
                    <td><Pill live={live} /></td>
                    <td className="mono">{addedStamp(p.addedAt)}</td>
                    <td><div className="rowacts">{live && <Rowbtn warn title={'Remove the rate dated ' + fmtDate(p.from)} onClick={() => remove(p)}>{I_BIN}</Rowbtn>}</div></td>
                  </tr>
                );
              }).reverse()}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title={'Add ' + c.noun} onClose={() => setOpen(false)} onSubmit={save}
               foot={<><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
                       <button className="btn primary" type="submit" disabled={busy}>Add rate</button></>}>
          <div className="mwho">
            <div className="r"><b>Site</b><span>{site.name}</span></div>
            <div className="r"><b>Replaces</b><span>{last ? last.rate.toFixed(c.dp) + ' from ' + fmtDate(last.from) : '—'}</span></div>
          </div>
          <div className="mrow">
            <Fld label="Takes effect" htmlFor="rd-from" err={errs['rd-from']}>
              <input id="rd-from" type="date" value={from} min={last ? plusDay(last.from) : undefined} max={todayIso()} onChange={e => setFrom(e.target.value)} />
            </Fld>
            <Fld label="Rate" htmlFor="rd-rate" err={errs['rd-rate']} hint={c.unit}>
              <input id="rd-rate" type="number" min="0" step={c.step} placeholder={c.ph} value={rate} onChange={e => setRate(e.target.value)} />
            </Fld>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function OffsetPane({ on, site }: { on: boolean; site: Site }) {
  const toast = useToast(), ask = useAsk();
  const of = useApi(s => api.getOffsets(site.id, { signal: s }), [site.id]);
  const dv = useApi(s => api.getSiteDevices(site.id, { signal: s }), [site.id]);
  const devName = (id: string) => dv.data?.find(d => d.id === id)?.name ?? id;
  const offNum = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-IN');
  const list: EnergyOffset[] = of.data ?? [];
  const seriesOf = (id: string) => list.filter(r => r.deviceId === id).sort((a, b) => (a.from < b.from ? -1 : 1));
  const rows = [...new Set(list.map(r => r.deviceId))].flatMap(id => {
    const g = seriesOf(id);
    return g.map((r, i) => ({ r, live: i === g.length - 1, until: i + 1 < g.length ? dayBefore(g[i + 1].from) : '—' }));
  }).sort((a, b) => { const an = devName(a.r.deviceId), bn = devName(b.r.deviceId); return an !== bn ? (an < bn ? -1 : 1) : (a.r.from < b.r.from ? 1 : -1); });

  const [open, setOpen] = useState(false);
  const [dev, setDev] = useState(''), [from, setFrom] = useState(''), [kwh, setKwh] = useState(''), [reason, setReason] = useState('');
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const lastOf = (id: string) => { const g = seriesOf(id); return g[g.length - 1] ?? null; };
  const devOpts = (dv.data ?? []).filter(d => !d.retired).sort(byName).map(d => ({ v: d.id, t: d.name, s: typeOf(d) }));

  const save = async () => {
    const v = parseFloat(kwh), w = reason.trim(), last = dev ? lastOf(dev) : null;
    const e = check([
      ['of-dev', !dev && 'Choose the device this corrects.'],
      ['of-from', !from ? 'An offset needs a date it takes effect.'
        : last && asDate(from) <= asDate(last.from) ? 'Must be after ' + fmtDate(last.from) + ', this device’s last offset.'
        : asDate(from) > today0() && 'An offset takes effect from a date that has arrived, not a future one.'],
      ['of-kwh', !kwh.trim() ? 'An offset is required — use 0 to end a correction.' : isNaN(v) ? 'That is not a number.' : Math.abs(v) > 1e7 && 'That is larger than any correction should be.'],
      ['of-why', !w ? 'Say what is being corrected — an untraceable adjustment reads as a broken meter.' : w.length < 8 && 'A few more words: this is the only record of why.'],
    ]);
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await api.addOffset(site.id, { deviceId: dev, from, kwh: v, reason: w }); setOpen(false); of.reload(); toast('Offset added to ' + devName(dev)); }
    catch (x) { toast('Could not add the offset: ' + why(x), true); }
    finally { setBusy(false); }
  };
  const remove = (r: EnergyOffset) => {
    const g = seriesOf(r.deviceId), prev = g[g.length - 2], nm = devName(r.deviceId);
    ask({
      title: 'Remove offset',
      rows: [['Device', nm], ['Offset', offNum(r.kwh) + ' kWh'], ['Active from', fmtDate(r.from)]],
      text: <>This is the correction <b>{nm}</b> is being reported with now. {prev
        ? <>Removing it hands the period back to {offNum(prev.kwh)} kWh, active from {fmtDate(prev.from)}.</>
        : <>Removing it means {nm} is reported exactly as it meters, with no correction at all.</>}</>,
      go: 'Remove offset',
      then: async () => {
        try { await api.removeOffset(site.id, r.deviceId, r.from); of.reload(); toast('Offset removed'); }
        catch (x) { toast('Could not remove it: ' + why(x), true); }
      },
    });
  };

  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-energy-offset">
      <div className="chead">
        <div className="title">Energy Offset</div>
        <div className="tools">
          <SitePin name={site.name} />
          <button className="tbtn" type="button" disabled={!of.data} onClick={() => { setDev(''); setFrom(''); setKwh(''); setReason(''); setErrs({}); setOpen(true); }}>{I_PLUS}ADD OFFSET</button>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Device</th><th>From</th><th>Until</th><th>Offset <span className="u">kWh</span></th><th>Reason</th><th>Status</th>
            <th title="When the row was entered, which is not when the offset took effect">Added</th><th /></tr></thead>
          <tbody>
            {!of.data ? <tr><td colSpan={8}><DataGate loading={of.loading} error={of.error} what="offsets" onRetry={of.reload} /></td></tr>
              : !rows.length ? <tr><td colSpan={8}><div className="empty-note">Nothing is being corrected on {site.name} — metered generation is reported as the devices report it</div></td></tr>
              : rows.map(({ r, live, until }) => (
                <tr key={r.deviceId + r.from}>
                  <td className="nm">{devName(r.deviceId)}</td>
                  <td className="mono">{fmtDate(r.from)}</td>
                  <td className={'mono' + (live ? ' dim' : '')}>{until}</td>
                  <td className="mono nm">{offNum(r.kwh)}</td>
                  <td className="why">{r.reason}</td>
                  <td><Pill live={live} /></td>
                  <td className="mono">{addedStamp(r.addedAt)}</td>
                  <td><div className="rowacts">{live && <Rowbtn warn title={'Remove the offset dated ' + fmtDate(r.from) + ' on ' + devName(r.deviceId)} onClick={() => remove(r)}>{I_BIN}</Rowbtn>}</div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Add energy offset" onClose={() => setOpen(false)} onSubmit={save}
               foot={<><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
                       <button className="btn primary" type="submit" disabled={busy}>Add offset</button></>}>
          <div className="mwho"><div className="r"><b>Site</b><span>{site.name}</span></div></div>
          <Fld label="Device" htmlFor="of-dev" err={errs['of-dev']}>
            <SsSelect id="of-dev" label="Device" any="Choose a device" empty="No devices in service at this site"
                      value={dev} options={devOpts} onPick={v => { setDev(v); setErrs(e => ({ ...e, 'of-dev': '', 'of-from': '' })); }} />
          </Fld>
          <div className="mrow">
            <Fld label="Takes effect" htmlFor="of-from" err={errs['of-from']}>
              <input id="of-from" type="date" value={from} max={todayIso()} min={dev && lastOf(dev) ? plusDay(lastOf(dev)!.from) : undefined} onChange={e => setFrom(e.target.value)} />
            </Fld>
            <Fld label="Offset" htmlFor="of-kwh" err={errs['of-kwh']} hint="kWh, negative to subtract">
              <input id="of-kwh" type="number" step="1" placeholder="-1250" value={kwh} onChange={e => setKwh(e.target.value)} />
            </Fld>
          </div>
          <Fld label="Reason" htmlFor="of-why" err={errs['of-why']}>
            <input id="of-why" type="text" maxLength={120} placeholder="What is being corrected, and why" value={reason} onChange={e => setReason(e.target.value)} />
          </Fld>
        </Modal>
      )}
    </section>
  );
}
