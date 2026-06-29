import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
}

export function PageWrapper({ children, title, actions }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="flex-1 p-4 lg:p-6 space-y-6"
    >
      {(title || actions) && (
        <div className="flex items-center justify-between">
          {title && (
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
          )}
          {actions && (
            <div className="flex items-center gap-3">{actions}</div>
          )}
        </div>
      )}
      {children}
    </motion.div>
  );
}
