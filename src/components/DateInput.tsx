import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import { ignoreErrors } from '../lib/ignoreErrors';

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
      if (e.offsetX >= el.clientWidth - 26) return;
      e.preventDefault();
      if (open.current) { el.blur(); shut(); return; }
      el.focus({ preventScroll: true });
      ignoreErrors(() => { el.showPicker?.(); open.current = true; });
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (open.current) { el.blur(); shut(); return; }
      ignoreErrors(() => { el.showPicker?.(); open.current = true; });
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
