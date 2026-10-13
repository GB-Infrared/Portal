import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, type FailureKind } from '../api/client';
import * as api from '../api/portal';
import { useAuth } from '../auth/AuthContext';
import { startLimb, startSky } from './login/canvases';
import '../styles/pages/login.css';
import { ignoreErrors } from '../lib/ignoreErrors';

const BOOT: [string, string][] = [
  ['[ 0.214 ]  monitoring ...................... ', 'READY'],
  ['[ 0.395 ]  alarms .......................... ', 'READY'],
  ['[ 0.611 ]  analysis ........................ ', 'READY'],
  ['[ 0.742 ]  kpi ............................. ', 'READY'],
];
const BEAT = 165;
const STEPMS = BEAT * 2.2, RUNMS = STEPMS * 4, SLOWAT = 1.5;
const OPENING = [
  { say: 'CONNECTING', row: 'connecting', at: 16 },
  { say: 'LOADING SITES', row: 'loading sites', at: 48 },
  { say: 'PREPARING PORTAL', row: 'preparing portal', at: 79 },
  { say: 'OPENING', row: 'opening', at: 100 },
];
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const EYE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.2 12S5.8 5.4 12 5.4 21.8 12 21.8 12 18.2 18.6 12 18.6 2.2 12 2.2 12Z" /><circle cx="12" cy="12" r="3.1" /></svg>;
const EYE_OFF = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.4c6.2 0 9.8 6.6 9.8 6.6a17 17 0 0 1-2.9 3.8M6.2 7.5A17 17 0 0 0 2.2 12S5.8 18.6 12 18.6c1.5 0 2.8-.4 3.9-.9" /><path d="M10 10a2.9 2.9 0 0 0 4 4" /><path d="M3.2 3.2 20.8 20.8" /></svg>;

function Secret({ id, value, onChange, onEnter, auto, placeholder, bad, onCaps }: {
  id: string; value: string; onChange: (v: string) => void; onEnter: () => void; auto: string; placeholder: string; bad: boolean; onCaps: (on: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const caps = (e: KeyboardEvent) => ignoreErrors(() => onCaps(!!e.getModifierState?.('CapsLock')));
  return (
    <span className="lfield pw">
      <input ref={ref} id={id} type={show ? 'text' : 'password'} autoComplete={auto} placeholder={placeholder} value={value}
             className={bad ? 'bad' : undefined} onChange={e => onChange(e.target.value)}
             onKeyDown={e => { caps(e); if (e.key === 'Enter') onEnter(); }} onKeyUp={caps} onBlur={() => onCaps(false)} />
      <button className="reveal" type="button" title={show ? 'Hide passkey' : 'Show passkey'} aria-label={show ? 'Hide passkey' : 'Show passkey'}
              aria-pressed={show} onClick={() => { setShow(!show); ref.current?.focus(); }}>{show ? EYE_OFF : EYE}</button>
    </span>
  );
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { status, signIn } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLCanvasElement>(null), limbRef = useRef<HTMLCanvasElement>(null);
  const fly = useRef<(t: number) => void>(() => {});
  const ledger = useRef<HTMLDivElement>(null);
  const running = useRef(false);

  const [box, setBox] = useState<'signin' | 'reset' | 'opening'>('signin');
  const [shown, setShown] = useState(0);
  const [boot, setBoot] = useState(0);
  const [done, setDone] = useState(false);
  const [lu, setLu] = useState(''), [lp, setLp] = useState('');
  const [ru, setRu] = useState(''), [rp, setRp] = useState(''), [rp2, setRp2] = useState('');
  const [bad, setBad] = useState('');
  const [err, setErr] = useState(''), [rerr, setRerr] = useState(''), [rnote, setRnote] = useState('');
  const [caps, setCaps] = useState(false);
  const [who, setWho] = useState('—');
  const [busy, setBusy] = useState(false);
  const from = (loc.state as { from?: string } | null)?.from;

  useEffect(() => {
    document.documentElement.classList.add('void');
    document.title = 'ENEROPS OS · Sign in';
    return () => document.documentElement.classList.remove('void');
  }, []);
  useEffect(() => { if (status === 'in' && !running.current) nav(from || '/home', { replace: true }); }, [status, nav, from]);

  useEffect(() => {
    const stopSky = skyRef.current ? startSky(skyRef.current) : () => {};
    const limb = limbRef.current && root.current ? startLimb(limbRef.current, root.current) : null;
    if (limb) fly.current = limb.fly;
    return () => { stopSky(); limb?.stop(); };
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    const rows = 3, red = reducedMotion();
    if (red) { setShown(rows); setBoot(BOOT.length); setDone(true); return; }
    for (let i = 0; i < rows; i++) timers.push(window.setTimeout(() => setShown(i + 1), 90 + i * BEAT));
    let t = 90 + rows * BEAT;
    BOOT.forEach((_, i) => { timers.push(window.setTimeout(() => setBoot(i + 1), t)); t += i < 2 ? 300 : 165; });
    timers.push(window.setTimeout(() => setDone(true), t));
    const skip = () => { timers.forEach(clearTimeout); setShown(rows); setBoot(BOOT.length); setDone(true); };
    addEventListener('keydown', skip, { once: true });
    document.getElementById('lu')?.focus();
    return () => { timers.forEach(clearTimeout); removeEventListener('keydown', skip); };
  }, []);

  const openPortal = (email: string, password: string) => {
    const el = ledger.current; if (!el) return;
    running.current = true;
    setBox('opening'); setWho(email.toUpperCase());
    document.title = 'ENEROPS OS · Opening';
    const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
    const steps = q<HTMLDivElement>('#load-steps'), bar = q<HTMLDivElement>('#load-bar'), fill = q<HTMLElement>('#load-fill');
    const num = q<HTMLElement>('#load-num'), pct = q<HTMLDivElement>('#load-pct'), say = q<HTMLDivElement>('#load-say'), foot = q<HTMLDivElement>('#load-foot');
    bar.classList.remove('bad'); pct.classList.remove('bad'); bar.removeAttribute('aria-invalid');
    foot.querySelector('#load-retry')?.remove();
    bar.querySelectorAll('u').forEach(u => u.remove());
    steps.innerHTML = OPENING.map((s, n) => '<div class="lstep wait" id="lstep' + n + '"><span class="lt"></span><span class="ln">' + s.row + '</span><span class="ld"></span><span class="lv"></span></div>').join('');
    OPENING.slice(0, -1).forEach(s => { const u = document.createElement('u'); u.style.left = s.at + '%'; bar.appendChild(u); });
    const row = (n: number) => steps.querySelector('#lstep' + n) as HTMLElement;
    const mark = (n: number, cls: string) => { row(n).className = 'lstep ' + cls; };
    const put = (n: number, sel: string, txt: string) => { const e = row(n).querySelector(sel); if (e && e.textContent !== txt) e.textContent = txt; };
    const paint = (p: number) => { num.textContent = String(Math.round(p)); fill.style.width = p.toFixed(2) + '%'; };
    const clock = (ms: number) => '[ ' + (ms / 1000).toFixed(2) + ' ]';
    const red = reducedMotion();
    paint(0);
    const runT0 = performance.now();
    let siteCount = 0;

    const work: (() => Promise<string>)[] = [
      async () => { await signIn(email, password); return 'LINKED'; },
      async () => { const s = await api.getSites(); siteCount = s.length; return siteCount + (siteCount === 1 ? ' SITE' : ' SITES'); },
      async () => { await import('./SiteControl'); return 'READY'; },
      async () => 'GO',
    ];

    const fail = (n: number, e: unknown) => {
      const kind: FailureKind = e instanceof ApiError ? e.kind : 'NO RESPONSE';
      mark(n, 'fail'); put(n, '.lt', clock(performance.now() - runT0)); put(n, '.lv', kind);
      bar.classList.add('bad'); pct.classList.add('bad'); bar.setAttribute('aria-invalid', 'true');
      say.textContent = OPENING[n].say + ' FAILED: ' + kind;
      running.current = false;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lgo retry'; b.id = 'load-retry';
      if (n === 0 && kind === 'REFUSED') {
        b.textContent = 'BACK';
        b.onclick = () => { setBox('signin'); setBusy(false); setBad('lp'); setErr(((e as ApiError).message || 'OPERATOR OR PASSKEY NOT RECOGNISED').toUpperCase()); document.title = 'ENEROPS OS · Sign in'; requestAnimationFrame(() => document.getElementById('lp')?.focus()); };
      } else {
        b.textContent = 'RETRY';
        b.onclick = () => openPortal(email, password);
      }
      foot.appendChild(b); b.focus();
    };

    const dest = from || '/sites';
    let pFrom = 0;
    const step = (n: number) => {
      const s = OPENING[n], to = s.at;
      say.textContent = s.say; mark(n, 'run'); bar.setAttribute('aria-valuenow', String(to));
      let result: string | null = null, error: unknown = null, settled = false;
      work[n]().then(r => { result = r; settled = true; }, e => { error = e; settled = true; });
      let t0 = -1, said = false;
      const frame = (now: number) => {
        if (t0 < 0) t0 = now;
        const k = Math.min(1, Math.max(0, (now - t0) / STEPMS)), e = 1 - (1 - k) * (1 - k);
        paint(pFrom + (to - pFrom) * (red ? 1 : e));
        if (!red) put(n, '.lt', clock(performance.now() - runT0));
        if (!red) { const tt = Math.max(0, Math.min(1, (now - runT0) / RUNMS)); fly.current(tt * tt * (3 - 2 * tt)); }
        if (!said && !settled && now - t0 > STEPMS * SLOWAT) { said = true; mark(n, 'run slow'); put(n, '.lv', 'SLOW'); say.textContent = s.say + ' - TAKING LONGER THAN EXPECTED'; }
        if (k < 1 || !settled) { requestAnimationFrame(frame); return; }
        if (error) { fail(n, error); return; }
        pFrom = to; mark(n, 'done'); put(n, '.lt', clock(performance.now() - runT0)); put(n, '.lv', result as string);
        if (n + 1 < OPENING.length) step(n + 1);
        else window.setTimeout(() => nav(dest, { replace: true }), red ? 150 : 620);
      };
      requestAnimationFrame(frame);
    };
    step(0);
  };

  const authenticate = () => {
    const u = lu.trim();
    const no = !u ? ['lu', 'ENTER YOUR OPERATOR ADDRESS'] : !isEmail(u) ? ['lu', 'THAT IS NOT AN EMAIL ADDRESS'] : !lp ? ['lp', 'ENTER YOUR PASSKEY'] : null;
    if (no) { setBad(no[0]); setErr(no[1]); document.getElementById(no[0])?.focus(); return; }
    setBusy(true);
    openPortal(u, lp);
  };
  const reset = async () => {
    const u = ru.trim();
    const no = !u ? ['ru', 'ENTER YOUR OPERATOR ADDRESS'] : !isEmail(u) ? ['ru', 'THAT IS NOT AN EMAIL ADDRESS']
      : !rp ? ['rp', 'CHOOSE A NEW PASSKEY'] : rp.length < 8 ? ['rp', 'USE AT LEAST 8 CHARACTERS']
      : !rp2 ? ['rp2', 'TYPE THE NEW PASSKEY AGAIN'] : rp !== rp2 ? ['rp2', 'THE TWO PASSKEYS DO NOT MATCH'] : null;
    if (no) { setBad(no[0]); setRerr(no[1]); document.getElementById(no[0])?.focus(); return; }
    setBusy(true); setRerr(''); setRnote('');
    try {
      await api.requestPasswordReset(u, rp);
      setRnote('REQUEST SENT · CHECK YOUR EMAIL TO CONFIRM THE NEW PASSKEY');
      setRp(''); setRp2('');
    } catch (e) { setRerr(e instanceof ApiError ? e.kind + ' · ' + e.message.toUpperCase() : 'THE REQUEST DID NOT GO THROUGH'); }
    finally { setBusy(false); }
  };
  const goStep = (to: 'signin' | 'reset') => {
    if (to === 'reset' && lu.trim() && !ru) setRu(lu.trim());
    if (to === 'signin' && ru.trim() && !lu) setLu(ru.trim());
    setBad(''); setErr(''); setRerr(''); setRnote('');
    setBox(to);
    document.title = 'ENEROPS OS · ' + (to === 'reset' ? 'Reset passkey' : 'Sign in');
    requestAnimationFrame(() => document.getElementById(to === 'reset' ? 'ru' : 'lu')?.focus());
  };
  const stepCls = (i: number) => 'step' + (box !== 'signin' || shown > i ? ' in' : '');
  const clear = (id: string, set: (v: string) => void, which: 'l' | 'r') => (v: string) => { set(v); if (bad === id) setBad(''); if (which === 'l') setErr(''); else setRerr(''); };

  return (
    <div className="pg-login" ref={root}>
      <canvas id="sky" ref={skyRef} aria-hidden="true" />
      <canvas id="limb" ref={limbRef} aria-hidden="true" />
      <div className="vignette" /><div className="grain" />
      <div className="corner tl" /><div className="corner br" />

      <div id="boot">
        <div className="stack">
          <div className="brand">
            <img src="/logo/logo-mark.png" alt="EnerOps Data Systems Pvt Ltd" />
            <span><span className="word">ENEROPS OS</span><span className="sub">Site Control</span></span>
          </div>

          <div className={'lbox' + (box === 'signin' ? ' on' : '')} id="loginbox">
            <div className={'lrow ' + stepCls(0)}>
              <label htmlFor="lu">Operator</label>
              <span className="lfield"><input id="lu" type="email" autoComplete="username" spellCheck={false} autoCapitalize="off" placeholder="you@company.com"
                     className={bad === 'lu' ? 'bad' : undefined} value={lu} onChange={e => clear('lu', setLu, 'l')(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') authenticate(); }} /></span>
            </div>
            <div className={'lrow ' + stepCls(1)}>
              <label htmlFor="lp">Passkey</label>
              <Secret id="lp" value={lp} onChange={clear('lp', setLp, 'l')} onEnter={authenticate} auto="current-password" placeholder="••••••••" bad={bad === 'lp'} onCaps={setCaps} />
            </div>
            <div className={'lcaps' + (caps && box === 'signin' ? ' on' : '')}>CAPS LOCK IS ON</div>
            <div className={'lact ' + stepCls(2)}>
              <button className="lgo" id="lgo" type="button" disabled={busy} onClick={authenticate}>{busy && box === 'signin' && <span className="spin" />}AUTHENTICATE</button>
              <button className="lalt" type="button" onClick={() => goStep('reset')}>LOST PASSKEY?</button>
            </div>
            <div className="lerr">{err}</div>
          </div>

          <div className={'lbox' + (box === 'reset' ? ' on' : '')} id="resetbox">
            <div className="lrow step in">
              <label htmlFor="ru">Operator</label>
              <span className="lfield"><input id="ru" type="email" autoComplete="username" spellCheck={false} autoCapitalize="off" placeholder="you@company.com"
                     className={bad === 'ru' ? 'bad' : undefined} value={ru} onChange={e => clear('ru', setRu, 'r')(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') reset(); }} /></span>
            </div>
            <div className="lrow step in">
              <label htmlFor="rp">New passkey</label>
              <Secret id="rp" value={rp} onChange={clear('rp', setRp, 'r')} onEnter={reset} auto="new-password" placeholder="At least 8 characters" bad={bad === 'rp'} onCaps={setCaps} />
            </div>
            <div className="lrow step in">
              <label htmlFor="rp2">Confirm</label>
              <Secret id="rp2" value={rp2} onChange={clear('rp2', setRp2, 'r')} onEnter={reset} auto="new-password" placeholder="Type it again" bad={bad === 'rp2'} onCaps={setCaps} />
            </div>
            <div className={'lcaps' + (caps && box === 'reset' ? ' on' : '')}>CAPS LOCK IS ON</div>
            <div className="lact step in">
              <button className="lgo" id="rgo" type="button" disabled={busy} onClick={reset}>{busy && box === 'reset' && <span className="spin" />}SET PASSKEY</button>
              <button className="lalt" type="button" onClick={() => goStep('signin')}>CANCEL</button>
            </div>
            <div className="lerr">{rerr}</div>
            <div className="lhint">{rnote || 'MINIMUM 8 CHARACTERS'}</div>
          </div>

          {box !== 'opening' && (
            <pre id="bootlog">{BOOT.slice(0, boot).map(([t, b]) => <div key={t}>{t}<b>{b}</b></div>)}</pre>
          )}

          <div className="load" id="loading" hidden={box !== 'opening'} ref={ledger}>
            <div className="lop">{who}</div>
            <div className="lsteps" id="load-steps" />
            <div className="lfoot" id="load-foot">
              <div className="lbar" id="load-bar" role="progressbar" aria-labelledby="load-say" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><i id="load-fill" /></div>
              <div className="lpct" id="load-pct" aria-hidden="true"><b id="load-num">0</b><i>%</i></div>
            </div>
            <div className="vh" id="load-say" role="status" aria-live="polite">CONNECTING</div>
          </div>
        </div>
      </div>
      <div className="skip">{done || reducedMotion() ? '' : 'PRESS ANY KEY TO SKIP'}</div>
    </div>
  );
}
