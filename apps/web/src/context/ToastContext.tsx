import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Icon } from '../components/Icon';

type ToastKind = 'success' | 'error' | 'token';

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  token: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((item) => item.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      counter.current += 1;
      const id = counter.current;
      setItems((list) => [...list.slice(-2), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3800);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => push('success', text),
      error: (text) => push('error', text),
      token: (text) => push('token', text),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.kind}`} role={item.kind === 'error' ? 'alert' : undefined}>
            <span className="toast-icon">
              <Icon name={item.kind === 'error' ? 'alert' : item.kind === 'token' ? 'gift' : 'check'} size={14} strokeWidth={2.5} />
            </span>
            <span>{item.text}</span>
            <button className="toast-close" type="button" aria-label="بستن پیام" onClick={() => dismiss(item.id)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider missing');
  return ctx;
}
