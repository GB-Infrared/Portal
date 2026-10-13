import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; msg: string; err?: boolean };
const Ctx = createContext<(msg: string, err?: boolean) => void>(() => {});

let next = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const show = useCallback((msg: string, err?: boolean) => {
    const id = next++;
    setList(l => [...l, { id, msg, err }]);
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite">
        {list.map(t => <div key={t.id} className={'toast' + (t.err ? ' err' : '')}>{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
