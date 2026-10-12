import { useState } from 'react';
import * as api from '../../api/portal';
import type { AccountUser, AlarmRecipient, Role, Severity, Site } from '../../api/types';
import { DataGate } from '../../components/DataState';
import { useToast } from '../../components/Toasts';
import type { ApiState } from '../../hooks/useApi';
import { useApi } from '../../hooks/useApi';
import { check, Fld, Modal, type Errs } from './Modal';
import { SsSelect } from './SsSelect';
import { EMAIL, I_BACK, I_BIN, I_BOX, I_PEN, I_PLUS, Pill, Rowbtn, useAsk, why } from './common';

const SEVS: { k: Severity; t: string }[] = [{ k: 'critical', t: 'Critical' }, { k: 'alarm', t: 'Alarm' }, { k: 'warn', t: 'Warning' }, { k: 'event', t: 'Event' }];
const userName = (u: { first: string; last: string }) => (u.first + ' ' + u.last).trim();

/* ---------- ALARMS CONFIG ----------
   Who hears about an alarm, and which of the portal's four levels reach them.
   Not per site: an alarm reaches a person, and a person does not stop existing
   when Site Control is pointed somewhere else. */
export function AlarmsConfigPane({ on, users }: { on: boolean; users: AccountUser[] | null }) {
  const toast = useToast(), ask = useAsk();
  const rc = useApi(s => api.getRecipients({ signal: s }), []);
  const list: AlarmRecipient[] = rc.data ?? [];
  const [edit, setEdit] = useState<AlarmRecipient | 'new' | null>(null);
  const [who, setWho] = useState(''), [mail, setMail] = useState('');
  const [sev, setSev] = useState<Record<Severity, boolean>>({ critical: false, alarm: false, warn: false, event: false });
  const [pickU, setPickU] = useState('');
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const editing = edit && edit !== 'new' ? edit : null;

  const open = (r: AlarmRecipient | 'new') => {
    setEdit(r); setErrs({}); setPickU('');
    setWho(r === 'new' ? '' : r.name); setMail(r === 'new' ? '' : r.email);
    setSev(r === 'new' ? { critical: false, alarm: false, warn: false, event: false } : { ...r.severities });
  };
  /* ONLY USERS NOT ALREADY ON THE LIST ARE OFFERED - and the row being edited
     does not count as taken */
  const taken = list.filter(r => r !== editing).map(r => r.email.toLowerCase());
  const userOpts = (users ?? []).filter(u => !taken.includes(u.email.toLowerCase())).map(u => ({ v: u.id, t: userName(u), s: u.email }));

  const save = async () => {
    const w = who.trim(), m = mail.trim();
    const e = check([
      ['al-who', !w && 'A name is required.'],
      ['al-mail', !m ? 'An email address is required.' : !EMAIL.test(m) ? 'That does not look like an email address.'
        : list.some(x => x !== editing && x.email.toLowerCase() === m.toLowerCase()) && 'That address is already on the list.'],
      /* a recipient sent nothing is a row that looks like coverage and is not */
      ['al-critical', !SEVS.some(s => sev[s.k]) && 'Pick at least one — a recipient sent nothing is not a recipient.'],
    ]);
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await api.saveRecipient(editing?.id ?? null, { name: w, email: m, severities: sev }); setEdit(null); rc.reload(); toast(editing ? w + ' updated' : w + ' will be told'); }
    catch (x) { toast('Could not save: ' + why(x), true); }
    finally { setBusy(false); }
  };
  const remove = (r: AlarmRecipient) => {
    const alone = r.severities.critical && list.filter(x => x.severities.critical).length === 1;
    ask({
      title: 'Remove recipient', rows: [['Name', r.name], ['Email', r.email]],
      text: <><b>{r.name}</b> stops being sent anything from this account. Alarms already raised are not affected — this changes who hears about the next one.{alone && <> <b>They are the only person currently sent criticals.</b></>}</>,
      go: 'Remove recipient',
      then: async () => { try { await api.removeRecipient(r.id); rc.reload(); toast(r.name + ' removed'); } catch (x) { toast('Could not remove: ' + why(x), true); } },
    });
  };
  const crit = list.filter(r => r.severities.critical).length;

  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-alarms-config">
      <div className="chead">
        <div className="title">Alarms config</div>
        <div className="tools">
          {/* the count that matters is whether anyone is sent the worst level */}
          <span className="count">{rc.data ? list.length + ' recipient' + (list.length === 1 ? '' : 's') + ' · ' + (crit ? crit + ' sent criticals' : 'nobody is sent criticals') : ''}</span>
          <button className="tbtn" type="button" disabled={!rc.data} onClick={() => open('new')}>{I_PLUS}ADD RECIPIENT</button>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Recipient</th><th>Email</th>
            <th className="sev-h critical" title="The worst level this portal raises — it outranks an alarm">Critical</th>
            <th className="sev-h alarm" title="Something is wrong and somebody has to act">Alarm</th>
            <th className="sev-h warn" title="Worth looking at before it becomes an alarm">Warning</th>
            <th className="sev-h" title="Something happened and was recorded — a reconnect, a firmware update">Event</th><th /></tr></thead>
          <tbody>
            {!rc.data ? <tr><td colSpan={7}><DataGate loading={rc.loading} error={rc.error} what="recipients" onRetry={rc.reload} /></td></tr>
              : !list.length ? <tr><td colSpan={7}><div className="empty-note">Nobody is being told about alarms on this account</div></td></tr>
              : list.map(r => (
                <tr key={r.id}>
                  <td className="nm">{r.name}</td><td>{r.email}</td>
                  {SEVS.map(sv => {
                    const y = r.severities[sv.k];
                    return <td className="sev-c" key={sv.k}><span className={'subdot ' + (y ? 'on ' : 'off ') + sv.k} role="img"
                      title={r.name + (y ? ' is sent ' : ' is not sent ') + sv.t.toLowerCase() + 's'} aria-label={sv.t + ': ' + (y ? 'yes' : 'no')} /></td>;
                  })}
                  <td><div className="rowacts">
                    <Rowbtn title={'Edit ' + r.name} onClick={() => open(r)}>{I_PEN}</Rowbtn>
                    <Rowbtn warn title={'Remove ' + r.name} onClick={() => remove(r)}>{I_BIN}</Rowbtn>
                  </div></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={editing ? 'Edit recipient' : 'Add recipient'} onClose={() => setEdit(null)} onSubmit={save}
               foot={<><button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button>
                       <button className="btn primary" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Add recipient'}</button></>}>
          {/* PICK A PERSON, or type somebody who is not one - the site office
              mailbox never signs in. Offered only while adding. */}
          {!editing && (
            <Fld label="From your users" htmlFor="al-user">
              <SsSelect id="al-user" label="Users not yet on this list" any="Type below, or pick a user" empty="Every user on this account is already being told"
                        value={pickU} options={userOpts}
                        onPick={v => { setPickU(v); const u = users?.find(x => x.id === v); if (u) { setWho(userName(u)); setMail(u.email); setErrs({}); } }} />
            </Fld>
          )}
          <div className="mrow">
            <Fld label="Name" htmlFor="al-who" err={errs['al-who']}><input id="al-who" type="text" maxLength={60} autoComplete="off" value={who} onChange={e => setWho(e.target.value)} data-autofocus={editing ? true : undefined} /></Fld>
            <Fld label="Email" htmlFor="al-mail" err={errs['al-mail']}><input id="al-mail" type="email" autoComplete="off" spellCheck={false} value={mail} onChange={e => setMail(e.target.value)} /></Fld>
          </div>
          <Fld label="Send them" err={errs['al-critical']}>
            <div className="subrow">
              {SEVS.map(sv => (
                <label className="subbox" key={sv.k}>
                  <input id={'al-' + sv.k} type="checkbox" checked={sev[sv.k]} onChange={e => setSev(s => ({ ...s, [sv.k]: e.target.checked }))} />{sv.t}
                </label>
              ))}
            </div>
          </Fld>
        </Modal>
      )}
    </section>
  );
}

/* a role that reaches everywhere is said in one chip rather than three */
function SiteChips({ ids, sites }: { ids: string[]; sites: Site[] }) {
  if (!ids.length) return <span className="chip">No sites</span>;
  if (sites.length && sites.every(s => ids.includes(s.id))) return <span className="chip all">All sites</span>;
  return <div className="chips">{ids.map(id => <span className="chip" key={id}>{sites.find(s => s.id === id)?.name ?? id}</span>)}</div>;
}

/* ---------- ROLE ----------
   A role is a name and the sites it reaches. A role somebody holds cannot be
   removed: "no role" is a decision for Access Control, not a side effect here. */
export function RolePane({ on, roles, users, sites }: { on: boolean; roles: ApiState<Role[]>; users: AccountUser[] | null; sites: Site[] }) {
  const toast = useToast(), ask = useAsk();
  const list = roles.data ?? [];
  const holders = (id: string) => (users ?? []).filter(u => u.roleId === id).length;
  const [edit, setEdit] = useState<Role | 'new' | null>(null);
  const [name, setName] = useState(''), [pick, setPick] = useState<string[]>([]);
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const editing = edit && edit !== 'new' ? edit : null;
  const open = (r: Role | 'new') => { setEdit(r); setErrs({}); setName(r === 'new' ? '' : r.name); setPick(r === 'new' ? [] : r.siteIds.slice()); };
  const save = async () => {
    const nm = name.trim();
    const e = check([
      ['ro-name', !nm ? 'A role needs a name.' : list.some(r => r !== editing && r.name.toLowerCase() === nm.toLowerCase()) && 'There is already a role called that.'],
      ['ro-s0', !pick.length && 'Pick at least one site — a role that reaches nothing grants nothing.'],
    ]);
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await api.saveRole(editing?.id ?? null, { name: nm, siteIds: sites.map(s => s.id).filter(id => pick.includes(id)) }); setEdit(null); roles.reload(); toast(editing ? nm + ' updated' : nm + ' added'); }
    catch (x) { toast('Could not save: ' + why(x), true); }
    finally { setBusy(false); }
  };
  const remove = (r: Role) => ask({
    title: 'Remove role', rows: [['Role', r.name], ['Reaches', r.siteIds.map(id => sites.find(s => s.id === id)?.name ?? id).join(', ') || 'nothing']],
    text: 'Nobody holds this role, so no one loses access by removing it.', go: 'Remove role',
    then: async () => { try { await api.removeRole(r.id); roles.reload(); toast(r.name + ' removed'); } catch (x) { toast('Could not remove: ' + why(x), true); } },
  });

  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-access-role">
      <div className="chead">
        <div className="title">Role</div>
        <div className="tools">
          <span className="count">{roles.data ? list.length + ' role' + (list.length === 1 ? '' : 's') : ''}</span>
          <button className="tbtn" type="button" disabled={!roles.data} onClick={() => open('new')}>{I_PLUS}ADD ROLE</button>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Role</th><th>Sites it reaches</th><th title="How many people currently hold this role">Held by</th><th /></tr></thead>
          <tbody>
            {!roles.data ? <tr><td colSpan={4}><DataGate loading={roles.loading} error={roles.error} what="roles" onRetry={roles.reload} /></td></tr>
              : !list.length ? <tr><td colSpan={4}><div className="empty-note">No roles yet, so nobody can reach a site</div></td></tr>
              : list.map(r => {
                const n = holders(r.id);
                return (
                  <tr key={r.id}>
                    <td className="nm">{r.name}</td>
                    <td className="pad"><SiteChips ids={r.siteIds} sites={sites} /></td>
                    <td className={'mono' + (n ? '' : ' dim')}>{n || '—'}</td>
                    <td><div className="rowacts">
                      <Rowbtn title={'Edit ' + r.name} onClick={() => open(r)}>{I_PEN}</Rowbtn>
                      {!n && <Rowbtn warn title={'Remove ' + r.name} onClick={() => remove(r)}>{I_BIN}</Rowbtn>}
                    </div></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={editing ? 'Edit role' : 'Add role'} onClose={() => setEdit(null)} onSubmit={save}
               foot={<><button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button>
                       <button className="btn primary" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Add role'}</button></>}>
          <Fld label="Role name" htmlFor="ro-name" err={errs['ro-name']} hint="What it lets someone reach, said in a few words.">
            <input id="ro-name" type="text" maxLength={40} autoComplete="off" value={name} onChange={e => setName(e.target.value)} />
          </Fld>
          <Fld label="Sites it reaches" err={errs['ro-s0']}>
            <div className="subrow">
              {sites.map((s, i) => (
                <label className="subbox" key={s.id}>
                  <input type="checkbox" id={'ro-s' + i} checked={pick.includes(s.id)}
                         onChange={e => setPick(p => (e.target.checked ? [...p, s.id] : p.filter(x => x !== s.id)))} />{s.name}
                </label>
              ))}
            </div>
          </Fld>
        </Modal>
      )}
    </section>
  );
}

/* ---------- USER ----------
   The people who can sign in. No DELETE: a person is suspended and keeps their
   name on everything they did. The role is NOT set here - Access Control is the
   one place a role is given; editing a user leaves their role as it was. */
export function UserPane({ on, users, roles }: { on: boolean; users: ApiState<AccountUser[]>; roles: Role[] }) {
  const toast = useToast(), ask = useAsk();
  const list = users.data ?? [];
  const [edit, setEdit] = useState<AccountUser | 'new' | null>(null);
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '' });
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const editing = edit && edit !== 'new' ? edit : null;
  const open = (u: AccountUser | 'new') => { setEdit(u); setErrs({}); setF(u === 'new' ? { first: '', last: '', email: '', phone: '' } : { first: u.first, last: u.last, email: u.email, phone: u.phone }); };
  const save = async () => {
    const v = { first: f.first.trim(), last: f.last.trim(), email: f.email.trim(), phone: f.phone.trim() };
    const e = check([
      ['us-first', !v.first && 'A first name is required.'],
      ['us-last', !v.last && 'A last name is required.'],
      ['us-mail', !v.email ? 'An email address is required — it is how they sign in.' : !EMAIL.test(v.email) ? 'That does not look like an email address.'
        : list.some(x => x !== editing && x.email.toLowerCase() === v.email.toLowerCase()) && 'Somebody already signs in with that address.'],
      ['us-phone', !!v.phone && v.phone.replace(/\D/g, '').length < 7 && 'That does not look like a phone number.'],
    ]);
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await api.saveUser(editing?.id ?? null, v); setEdit(null); users.reload(); toast(editing ? userName(v) + ' updated' : userName(v) + ' can now sign in'); }
    catch (x) { toast('Could not save: ' + why(x), true); }
    finally { setBusy(false); }
  };
  const hold = (u: AccountUser) => {
    if (!u.active) {
      api.setUserActive(u.id, true).then(() => { users.reload(); toast(userName(u) + ' can sign in again'); }, x => toast('Could not reactivate: ' + why(x), true));
      return;
    }
    ask({
      title: 'Suspend user', rows: [['Name', userName(u)], ['Email', u.email]],
      text: <><b>{userName(u)}</b> stops being able to sign in. Everything they have already done keeps their name on it, and this can be undone.</>,
      go: 'Suspend user',
      then: async () => { try { await api.setUserActive(u.id, false); users.reload(); toast(userName(u) + ' suspended'); } catch (x) { toast('Could not suspend: ' + why(x), true); } },
    });
  };
  const suspended = list.filter(u => !u.active).length;

  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-access-user">
      <div className="chead">
        <div className="title">User</div>
        <div className="tools">
          <span className="count">{users.data ? list.length + ' user' + (list.length === 1 ? '' : 's') + (suspended ? ' · ' + suspended + ' suspended' : '') : ''}</span>
          <button className="tbtn" type="button" disabled={!users.data} onClick={() => open('new')}>{I_PLUS}ADD USER</button>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Contact number</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>
            {!users.data ? <tr><td colSpan={6}><DataGate loading={users.loading} error={users.error} what="users" onRetry={users.reload} /></td></tr>
              : !list.length ? <tr><td colSpan={6}><div className="empty-note">Nobody can sign in to this account</div></td></tr>
              : list.map(u => {
                const role = roles.find(r => r.id === u.roleId);
                return (
                  <tr key={u.id} className={u.active ? undefined : 'gone'}>
                    <td className="nm">{userName(u)}</td><td>{u.email}</td><td className="mono">{u.phone || '—'}</td>
                    <td>{role ? role.name : <span className="chip">No role</span>}</td>
                    <td><Pill live={u.active} /></td>
                    <td><div className="rowacts">
                      <Rowbtn title={'Edit ' + userName(u)} onClick={() => open(u)}>{I_PEN}</Rowbtn>
                      {u.active ? <Rowbtn warn title={'Suspend ' + userName(u)} onClick={() => hold(u)}>{I_BOX}</Rowbtn>
                        : <Rowbtn title={'Reactivate ' + userName(u)} onClick={() => hold(u)}>{I_BACK}</Rowbtn>}
                    </div></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={editing ? 'Edit user' : 'Add user'} onClose={() => setEdit(null)} onSubmit={save}
               foot={<><button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button>
                       <button className="btn primary" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Add user'}</button></>}>
          <div className="mrow">
            <Fld label="First name" htmlFor="us-first" err={errs['us-first']}><input id="us-first" type="text" maxLength={40} autoComplete="off" value={f.first} onChange={e => setF({ ...f, first: e.target.value })} /></Fld>
            <Fld label="Last name" htmlFor="us-last" err={errs['us-last']}><input id="us-last" type="text" maxLength={40} autoComplete="off" value={f.last} onChange={e => setF({ ...f, last: e.target.value })} /></Fld>
          </div>
          <Fld label="Email" htmlFor="us-mail" err={errs['us-mail']} hint="This is what they sign in with.">
            <input id="us-mail" type="email" autoComplete="off" spellCheck={false} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          </Fld>
          <Fld label="Contact number" htmlFor="us-phone" err={errs['us-phone']}
               hint={<>A new user can sign in straight away, but reaches nothing until they are given a role on <b>Access Control</b>.</>}>
            <input id="us-phone" type="tel" autoComplete="off" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          </Fld>
        </Modal>
      )}
    </section>
  );
}

/* ---------- ACCESS CONTROL ----------
   Every user, every role, one table. The role is changed in the cell where it
   is read, and the sites it grants are printed beside it. */
export function AccessCtlPane({ on, users, roles, sites }: { on: boolean; users: ApiState<AccountUser[]>; roles: Role[]; sites: Site[] }) {
  const toast = useToast();
  const list = users.data ?? [];
  const set = async (u: AccountUser, roleId: string) => {
    const r = roles.find(x => x.id === roleId);
    try { await api.setUserRole(u.id, roleId || null); users.reload(); toast(r ? userName(u) + ' → ' + r.name : userName(u) + ' has no role'); }
    catch (x) { toast('Could not change the role: ' + why(x), true); }
  };
  /* the number worth surfacing is how many people can reach nothing */
  const none = list.filter(u => u.active && !roles.some(r => r.id === u.roleId)).length;
  const opts = [{ v: '', t: 'No role', none: true }, ...roles.map(r => ({ v: r.id, t: r.name }))];
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-access-ctl">
      <div className="chead">
        <div className="title">Access Control</div>
        <div className="tools"><span className="count">{users.data ? (none ? none + ' active user' + (none === 1 ? '' : 's') + ' with no role' : 'every active user has a role') : ''}</span></div>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>User</th><th>Role</th><th>Which gives them</th><th>Status</th></tr></thead>
          <tbody>
            {!users.data ? <tr><td colSpan={4}><DataGate loading={users.loading} error={users.error} what="users" onRetry={users.reload} /></td></tr>
              : !list.length ? <tr><td colSpan={4}><div className="empty-note">There is nobody to give access to</div></td></tr>
              : list.map(u => {
                const role = roles.find(r => r.id === u.roleId);
                return (
                  <tr key={u.id} className={u.active ? undefined : 'gone'}>
                    <td className="nm">{userName(u)}</td>
                    <td className="pad"><SsSelect className="mini" label="Role" any="No role" value={role ? role.id : ''} options={opts}
                                                  ariaLabel={'Role for ' + userName(u)} onPick={v => set(u, v)} /></td>
                    <td className="pad">{role ? <SiteChips ids={role.siteIds} sites={sites} /> : <span className="chip">No sites</span>}</td>
                    <td><Pill live={u.active} /></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
