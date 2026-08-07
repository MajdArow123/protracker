import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /** Optional in-app destination rendered as a link inside the toast. */
  linkTo?: string;
  linkLabel?: string;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  linkTo?: string;
  linkLabel?: string;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
