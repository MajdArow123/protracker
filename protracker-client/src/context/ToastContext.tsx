import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ToastContext, type Toast, type ToastOptions, type ToastType } from './useToast';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', options?: ToastOptions) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type, linkTo: options?.linkTo, linkLabel: options?.linkLabel }]);
    // Toasts carrying a link stay longer — the user needs time to click it.
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      options?.linkTo ? 8000 : 4000
    );
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}
