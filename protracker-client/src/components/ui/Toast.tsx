import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import type { ToastType } from '../../context/ToastContext';

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success:
    'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  error:
    'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  warning:
    'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="toast-stack fixed top-4 right-4 rtl:right-auto rtl:left-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ x: 64, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 64, opacity: 0 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-72 max-w-sm ${colors[toast.type]}`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
