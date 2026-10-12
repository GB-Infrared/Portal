import { useEffect, useRef, type InputHTMLAttributes } from 'react';

/* THE WHOLE FIELD IS THE BUTTON THAT OPENS THE CALENDAR.

   A date input only reacts to a click on its 12px indicator glyph, so a click
   on the number - most of the control, and where anyone aims - did nothing.
   It toggles (showPicker has no close, so the second click blurs instead), it
   does not select text, and the open flag is reset by anything that can close
   the native popup without us. */

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  value: string;
  onValue: (v: string) => void;
};

export function DateInput({ value, onValue, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const open = useRef(false);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const shut = () => { open.current = false; };
    const docDown = (e: MouseEvent) => { if (e.target !== el) shut(); };
    const down = (e: MouseEvent) => {
      if (e.offsetX >= el.clientWidth - 26) return;      /* the indicator toggles itself */
      e.preventDefault();
      if (open.current) { el.blur(); shut(); return; }
      el.focus({ preventScroll: true });
      try { el.showPicker?.(); open.current = true; } catch { /* not allowed here */ }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (open.current) { el.blur(); shut(); return; }
      try { el.showPicker?.(); open.current = true; } catch { /* not allowed here */ }
    };
    el.addEventListener('blur', shut);
    el.addEventListener('mousedown', down);
    el.addEventListener('keydown', key);
    document.addEventListener('mousedown', docDown, true);
    return () => {
      el.removeEventListener('blur', shut);
      el.removeEventListener('mousedown', down);
      el.removeEventListener('keydown', key);
      document.removeEventListener('mousedown', docDown, true);
    };
  }, []);

  return <input ref={ref} type="date" value={value} {...rest}
                onChange={e => { open.current = false; if (e.target.value) onValue(e.target.value); }} />;
}
