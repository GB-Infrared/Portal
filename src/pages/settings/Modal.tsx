import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';

const X = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>;

export function Modal({ title, onClose, onSubmit, children, foot }: {
  title: string; onClose: () => void; onSubmit?: (e: FormEvent) => void; children: ReactNode; foot: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.body.classList.add('locked');
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    requestAnimationFrame(() => {
      const el = box.current?.querySelector<HTMLElement>('[data-autofocus]') ?? box.current?.querySelector<HTMLElement>('input:not([type=checkbox]):not([disabled]), button.mbtn');
      el?.focus();
      if (el instanceof HTMLInputElement) el.select();
    });
    return () => { document.body.classList.remove('locked'); document.removeEventListener('keydown', key); };
  }, [onClose]);
  const inner = (
    <>
      <div className="mbody">{children}</div>
      <div className="mfoot"><span className="sp" />{foot}</div>
    </>
  );
  return (
    <div className="scrim on" role="dialog" aria-modal="true" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" ref={box}>
        <div className="mhead">
          <div className="t">{title}</div>
          <button className="x" type="button" onClick={onClose} title="Close" aria-label="Close">{X}</button>
        </div>
        {onSubmit ? <form noValidate onSubmit={e => { e.preventDefault(); onSubmit(e); }}>{inner}</form> : inner}
      </div>
    </div>
  );
}

export function Fld({ label, htmlFor, err, hint, children, id }: {
  label: ReactNode; htmlFor?: string; err?: string; hint?: ReactNode; children: ReactNode; id?: string;
}) {
  return (
    <div className={'fld' + (err ? ' bad' : '')} id={id}>
      <label className="lab" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
      <div className="err">{err || ''}</div>
    </div>
  );
}

export type Errs = Record<string, string>;
export function check(rules: [string, string | false | null | undefined][]): Errs {
  const e: Errs = {};
  for (const [k, msg] of rules) if (msg && !e[k]) e[k] = msg;
  const first = Object.keys(e)[0];
  if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
  return e;
}
