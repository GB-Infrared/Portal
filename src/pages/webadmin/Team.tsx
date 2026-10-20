import * as api from '../../api/portal';
import type { TeamRole, TeamUser, WaCustomer } from '../../api/types';
import { useToast } from '../../components/Toasts';
import type { ApiState } from '../../hooks/useApi';
import { LEVEL_NAME } from '../../lib/levels';
import { I_PLUS, useAsk, why } from '../settings/common';
import { SsSelect } from '../settings/SsSelect';
import { sv, useForm, type Field } from './Form';
import { count, dash, Grid, RowActs } from './Grid';

export interface TeamCtx {
  team: ApiState<TeamUser[]>;
  roles: ApiState<TeamRole[]>;
  customers: WaCustomer[] | null;
  adminView: boolean;
  manageUsers: boolean;
  manageRoles: boolean;
}

const nameOf = (o: TeamUser) => (o.first + ' ' + o.last).trim();
const shown = (t: TeamCtx) => (t.team.data ?? []).filter(o => !t.adminView || o.level === 'plant');

function Reach({ ids, customers }: { ids: string[]; customers: WaCustomer[] | null }) {
  const names = ids.map(id => customers?.find(c => c.id === id)?.name ?? id);
  return names.length ? <>{names.join(', ')}</> : <span className="none-t">None</span>;
}

const OP_FIELDS: Field[] = [
  { k: 'first', label: 'First name' }, { k: 'last', label: 'Last name' },
  { k: 'level', label: 'Role level', type: 'select', def: 'plant', span: true, opts: [{ v: 'admin', t: 'Admin' }, { v: 'plant', t: 'Plant Admin' }],
    hint: 'Admin: plants, loggers, devices and the device catalogue. Plant Admin: adds and sets up plants for the customers their role reaches.' },
  { k: 'email', label: 'Email', type: 'email', span: true, hint: 'This is what they sign in with.' },
  { k: 'phone', label: 'Contact number', type: 'tel', opt: true, span: true,
    hint: <>A new user can sign in straight away, but reaches no customer until they are given a role on <b>Access Control</b>.</> },
];

export function UsersPane({ on, t }: { on: boolean; t: TeamCtx }) {
  const toast = useToast(), ask = useAsk();
  const [dialog, setForm] = useForm();
  const word = t.adminView ? 'Plant Admin' : 'user';
  const add = () => setForm({
    title: 'Add ' + word, go: 'Add ' + word, fields: t.adminView ? OP_FIELDS.filter(f => f.k !== 'level') : OP_FIELDS,
    check: v => (t.team.data ?? []).some(o => o.email.toLowerCase() === sv(v, 'email').toLowerCase()) ? ['email', 'Another user already signs in with this.'] : null,
    save: async v => {
      const level = t.adminView || sv(v, 'level') !== 'admin' ? 'plant' as const : 'admin' as const;
      await api.waAddTeamUser({ first: sv(v, 'first'), last: sv(v, 'last'), email: sv(v, 'email'), phone: sv(v, 'phone'), level });
      t.team.reload();
      return (sv(v, 'first') + ' ' + sv(v, 'last')).trim() + ' added as ' + LEVEL_NAME[level];
    },
  });
  const del = (o: TeamUser) => ask({
    title: 'Delete user', rows: [['User', nameOf(o)], ['Email', o.email], ['Role level', LEVEL_NAME[o.level]]],
    text: 'They can no longer sign in to the web admin panel.', go: 'Delete user',
    then: async () => { try { await api.waRemoveTeamUser(o.id); t.team.reload(); toast(nameOf(o) + ' deleted'); } catch (x) { toast('Could not delete: ' + why(x), true); } },
  });
  const cols = [{ t: 'First name' }, { t: 'Last name' }, { t: 'Email' }, { t: 'Contact number' }, ...(t.adminView ? [] : [{ t: 'Role level' }]), { t: '' }];
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-operators">
      <div className="chead"><div className="tools">
        {t.manageUsers && <button className="tbtn add" type="button" id="op-add" disabled={!t.team.data} onClick={add}>{I_PLUS}ADD USER</button>}
      </div></div>
      <Grid what="users" state={t.team} rows={t.team.data && shown(t)} empty={t.adminView ? 'No Plant Admins yet' : 'No users yet'} cols={cols}
            row={o => (
              <tr key={o.id}>
                <td className="nm">{o.first}</td><td className="nm">{o.last}</td><td>{o.email}</td><td>{dash(o.phone)}</td>
                {!t.adminView && <td>{LEVEL_NAME[o.level]}</td>}
                <td>{t.manageUsers && <RowActs onDel={() => del(o)} />}</td>
              </tr>
            )} />
      {dialog}
    </section>
  );
}

export function RolesPane({ on, t }: { on: boolean; t: TeamCtx }) {
  const toast = useToast(), ask = useAsk();
  const [dialog, setForm] = useForm();
  const list = t.roles.data;
  const fields: Field[] = [
    { k: 'name', label: 'Role name', span: true },
    { k: 'cust', label: 'Customers it reaches', type: 'checks', span: true, opts: (t.customers ?? []).map(c => ({ v: c.id, t: c.name })) },
  ];
  const clash = (name: string, self: TeamRole | null): [string, string] | null =>
    (list ?? []).some(r => r !== self && r.name.toLowerCase() === name.toLowerCase()) ? ['name', 'There is already a role called that.'] : null;
  const heldBy = (r: TeamRole) => shown(t).filter(o => o.roleId === r.id);
  const add = () => setForm({
    title: 'Add role', go: 'Add role', fields, check: v => clash(sv(v, 'name'), null),
    save: async v => { await api.waSaveRole(null, { name: sv(v, 'name'), customerIds: v.cust as string[] }); t.roles.reload(); return sv(v, 'name') + ' added'; },
  });
  const edit = (r: TeamRole) => setForm({
    title: 'Edit role', go: 'Save changes', fields, values: { name: r.name, cust: r.customerIds.slice() }, check: v => clash(sv(v, 'name'), r),
    save: async v => { await api.waSaveRole(r.id, { name: sv(v, 'name'), customerIds: v.cust as string[] }); t.roles.reload(); return sv(v, 'name') + ' updated'; },
  });
  const del = (r: TeamRole) => {
    const held = heldBy(r).length;
    ask({
      title: 'Delete role', rows: [['Role', r.name]], go: 'Delete role',
      text: held ? <>{count(held, 'user')} {held === 1 ? 'holds' : 'hold'} this role. They keep their sign-in but reach no customer until they are given another role on <b>Access Control</b>.</>
        : 'Nobody holds this role, so nobody loses access.',
      then: async () => { try { await api.waRemoveRole(r.id); t.roles.reload(); t.team.reload(); toast(r.name + ' deleted'); } catch (x) { toast('Could not delete: ' + why(x), true); } },
    });
  };
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-roles">
      <div className="chead"><div className="tools">
        {t.manageRoles && <button className="tbtn add" type="button" id="ro-add" disabled={!list} onClick={add}>{I_PLUS}ADD ROLE</button>}
      </div></div>
      <Grid what="roles" state={t.roles} rows={list} empty="No roles yet"
            cols={[{ t: 'Role name' }, { t: 'Customers it reaches' }, { t: 'Held by', num: true }, { t: '' }]}
            row={r => (
              <tr key={r.id}>
                <td className="nm">{r.name}</td><td className="wrap"><Reach ids={r.customerIds} customers={t.customers} /></td>
                <td className="num">{heldBy(r).length}</td>
                <td>{t.manageRoles && <RowActs onEdit={() => edit(r)} onDel={() => del(r)} />}</td>
              </tr>
            )} />
      {dialog}
    </section>
  );
}

export function AccessPane({ on, t }: { on: boolean; t: TeamCtx }) {
  const toast = useToast();
  const roles = t.roles.data ?? [];
  const opts = [{ v: '', t: 'No role', none: true }, ...roles.map(r => ({ v: r.id, t: r.name }))];
  const set = async (o: TeamUser, roleId: string) => {
    try {
      await api.waSetTeamRole(o.id, roleId || null); t.team.reload();
      const r = roles.find(x => x.id === roleId);
      toast(r ? nameOf(o) + ' now holds ' + r.name : nameOf(o) + ' no longer holds a role');
    } catch (x) { toast('Could not change the role: ' + why(x), true); }
  };
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-assign">
      <Grid what="users" state={t.team} rows={t.team.data && shown(t)} empty="No users yet"
            cols={[{ t: 'User' }, { t: 'Email' }, { t: 'Role level' }, { t: 'Role' }, { t: 'Customers they reach' }]}
            row={o => {
              const r = roles.find(x => x.id === o.roleId);
              return (
                <tr key={o.id}>
                  <td className="nm">{nameOf(o)}</td><td>{o.email}</td><td>{LEVEL_NAME[o.level]}</td>
                  {t.manageRoles
                    ? <td className="pad"><SsSelect className="mini" label="Role" any="No role" value={r ? r.id : ''} options={opts} onPick={v => { void set(o, v); }} /></td>
                    : <td>{r ? r.name : <span className="none-t">No role</span>}</td>}
                  <td className="wrap">{r ? <Reach ids={r.customerIds} customers={t.customers} /> : <span className="none-t">None</span>}</td>
                </tr>
              );
            }} />
    </section>
  );
}
