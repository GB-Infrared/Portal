import { useState, type ReactNode } from 'react';
import * as api from '../../api/portal';
import type { Profile } from '../../api/types';
import { DataGate } from '../../components/DataState';
import { useToast } from '../../components/Toasts';
import { useApi } from '../../hooks/useApi';
import { check, Fld, Modal, type Errs } from './Modal';
import { EMAIL, Pill, why } from './common';

const FIELDS: { k: keyof Omit<Profile, 'roleLabel'>; label: string; type: string; ac: string; hint?: string }[] = [
  { k: 'first', label: 'First name', type: 'text', ac: 'given-name' },
  { k: 'last', label: 'Last name', type: 'text', ac: 'family-name' },
  { k: 'company', label: 'Company name', type: 'text', ac: 'organization', hint: 'The trading name. The registered one belongs in Company Profile.' },
  { k: 'address', label: 'Address', type: 'text', ac: 'street-address' },
  { k: 'email', label: 'Email', type: 'email', ac: 'email', hint: 'The address you sign in with.' },
  { k: 'phone', label: 'Contact number', type: 'tel', ac: 'tel', hint: 'Leave it empty if there isn’t one — the profile then prints a dash rather than a guess.' },
];

const EYE = (
  <>
    <svg className="e1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.2 12S5.6 5.8 12 5.8 21.8 12 21.8 12 18.4 18.2 12 18.2 2.2 12 2.2 12z" /><circle cx="12" cy="12" r="3" /></svg>
    <svg className="e2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 5.9A9.7 9.7 0 0 1 12 5.8c6.4 0 9.8 6.2 9.8 6.2a17.2 17.2 0 0 1-3.4 4.2M6.3 7.9A17.2 17.2 0 0 0 2.2 12S5.6 18.2 12 18.2c1.4 0 2.6-.3 3.7-.8" /><path d="M10.1 10.2a2.7 2.7 0 0 0 3.8 3.8" /><path d="M3.6 3.6l16.8 16.8" /></svg>
  </>
);
const DOT = <svg className="dot" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="3.4" /></svg>;
const TICK = <svg className="tick" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6.5 9.4 17.5 4 12.2" /></svg>;

function PwField({ id, label, value, onChange, err, ac, children }: {
  id: string; label: string; value: string; onChange: (v: string) => void; err?: string; ac: string; children?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const t = show ? 'Hide password' : 'Show password';
  return (
    <Fld label={label} htmlFor={id} err={err}>
      <div className="pw">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={ac} value={value} onChange={e => onChange(e.target.value)} />
        <button className={'eye' + (show ? ' on' : '')} type="button" title={t} aria-label={t}
                onClick={() => { setShow(!show); document.getElementById(id)?.focus(); }}>{EYE}</button>
      </div>
      {children}
    </Fld>
  );
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [cur, setCur] = useState(''), [nw, setNw] = useState(''), [cf, setCf] = useState('');
  const [errs, setErrs] = useState<Errs>({});
  const [band, setBand] = useState('');
  const [busy, setBusy] = useState(false);
  const len = nw.length >= 10, mix = /[A-Za-z]/.test(nw) && /\d/.test(nw), fresh = !!nw && nw !== cur;
  const save = async () => {
    setBand('');
    const e = check([
      ['pw-cur', !cur && 'Enter your current password.'],
      ['pw-new', (!len || !mix) ? 'This one does not meet all three rules below.' : nw === cur && 'Choose one you are not already using.'],
      ['pw-cf', cf !== nw && 'The two do not match.'],
    ]);
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await api.changePassword(cur, nw); onClose(); toast('Password changed'); }
    catch (x) { setBand(why(x)); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Change password" onClose={onClose} onSubmit={save}
           foot={<><button className="btn" type="button" onClick={onClose}>Cancel</button>
                   <button className="btn primary" type="submit" disabled={busy}>Update password</button></>}>
      <div className={'mband' + (band ? ' on' : '')}>{band}</div>
      <PwField id="pw-cur" label="Current password" ac="current-password" value={cur} onChange={setCur} err={errs['pw-cur']} />
      <PwField id="pw-new" label="New password" ac="new-password" value={nw} onChange={setNw} err={errs['pw-new']}>
        <div className="rules">
          <div className={'rule' + (len ? ' ok' : '')}>{DOT}{TICK}At least 10 characters</div>
          <div className={'rule' + (mix ? ' ok' : '')}>{DOT}{TICK}A letter and a number</div>
          <div className={'rule' + (fresh ? ' ok' : '')}>{DOT}{TICK}Different from your current password</div>
        </div>
      </PwField>
      <PwField id="pw-cf" label="Confirm new password" ac="new-password" value={cf} onChange={setCf} err={errs['pw-cf']} />
    </Modal>
  );
}

export function UserProfilePane({ on, onSaved }: { on: boolean; onSaved: (name: string, email: string) => void }) {
  const toast = useToast();
  const p = useApi(s => api.getProfile({ signal: s }), []);
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const d = p.data;

  const start = () => { if (!d) return; setVals(Object.fromEntries(FIELDS.map(f => [f.k, d[f.k]]))); setErrs({}); setEditing(true); requestAnimationFrame(() => { const el = document.getElementById('in-first') as HTMLInputElement | null; el?.focus(); el?.select(); }); };
  const save = async () => {
    const v = Object.fromEntries(FIELDS.map(f => [f.k, (vals[f.k] ?? '').trim()]));
    const e = check([
      ['in-first', !v.first && 'A first name is required.'],
      ['in-last', !v.last && 'A last name is required.'],
      ['in-email', !v.email ? 'An email address is required — it is how you sign in.' : !EMAIL.test(v.email) && 'That does not look like an email address.'],
      ['in-phone', !!v.phone && v.phone.replace(/\D/g, '').length < 7 && 'That does not look like a phone number.'],
    ]);
    setErrs(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.saveProfile(v as Omit<Profile, 'roleLabel'>);
      setEditing(false); p.reload(); onSaved((v.first + ' ' + v.last).trim(), v.email); toast('Profile updated');
    } catch (x) { toast('Could not save: ' + why(x), true); }
    finally { setBusy(false); }
  };

  const name = d ? (d.first + ' ' + d.last).trim() : '';
  return (
    <section className={'panel card' + (on ? ' on' : '') + (editing ? ' editing' : '')} id="p-user-profile">
      <div className="chead">
        <div className="title">User Profile</div>
        <span className="editing-tag">Editing</span>
        <div className="tools"><button className="tbtn edit" type="button" onClick={start} disabled={!d}>EDIT</button></div>
      </div>
      {!d ? <DataGate loading={p.loading} error={p.error} what="your profile" onRetry={p.reload} /> : (
        <>
          <div className="who">
            <div className="big">{(d.first || d.email || '?').charAt(0).toUpperCase()}</div>
            <div><div className="nm">{name || '—'}</div><div className="ro">{d.roleLabel ?? ''}</div></div>
          </div>
          <form noValidate onSubmit={e => { e.preventDefault(); save(); }}>
            <div className="fields">
              {FIELDS.map(f => (
                <div className={'f' + (errs['in-' + f.k] ? ' bad' : '')} key={f.k} data-k={f.k}>
                  <label className="k" htmlFor={'in-' + f.k}>{f.label}</label>
                  <div className={'v' + (d[f.k] ? '' : ' none')}>{d[f.k] || '—'}</div>
                  <div className="in">
                    <input id={'in-' + f.k} type={f.type} autoComplete={f.ac} spellCheck={false} value={vals[f.k] ?? ''}
                           aria-invalid={!!errs['in-' + f.k]} onChange={e => setVals(v => ({ ...v, [f.k]: e.target.value }))} />
                    {f.hint && <div className="hint">{f.hint}</div>}
                    <div className="err">{errs['in-' + f.k] || ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="editbar">
              <span className="note">Nothing changes until you save.</span>
              <span className="sp" />
              <button className="btn" type="button" onClick={() => { setEditing(false); setErrs({}); }}>Cancel</button>
              <button className="btn primary" type="submit" disabled={busy}>Save changes</button>
            </div>
          </form>
          <div className="cfoot">
            <span className="k">Password</span><span className="sp" />
            <button className="linkbtn" type="button" onClick={() => setPwOpen(true)}>Change password</button>
          </div>
        </>
      )}
      {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} />}
    </section>
  );
}

export function CompanyPane({ on }: { on: boolean }) {
  const c = useApi(s => api.getCompany({ signal: s }), []);
  const d = c.data;
  const v = (x: string | null | undefined) => <div className={'v' + (x ? '' : ' none')}>{x || '—'}</div>;
  return (
    <section className={'panel card' + (on ? ' on' : '')} id="p-company-profile">
      <div className="chead"><div className="title">Company Profile</div></div>
      {!d ? <DataGate loading={c.loading} error={c.error} what="the company profile" onRetry={c.reload} /> : (
        <>
          <div className="who co"><div><div className="nm">{d.name || '—'}</div></div></div>
          <div className="fields">
            <div className="f"><div className="k">Company name</div>{v(d.name)}</div>
            <div className="f"><div className="k">Address</div>{v(d.address)}</div>
            <div className="f"><div className="k">Company email</div>{v(d.companyEmail)}</div>
            <div className="f"><div className="k">Admin email</div>{v(d.adminEmail)}</div>
            <div className="f"><div className="k">Contact number</div>{v(d.phone)}</div>
            <div className="f"><div className="k">Customer service status</div>
              <div className="v">{d.serviceActive == null ? '—' : <Pill live={d.serviceActive} />}</div></div>
          </div>
          <div className="cfoot"><span className="n">Set when the account is provisioned. Nothing on this card is editable from the portal.</span></div>
        </>
      )}
    </section>
  );
}
