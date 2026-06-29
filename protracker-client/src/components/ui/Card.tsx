import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface Props {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, header, footer, className, hover, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden',
        hover && 'transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {header && (
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 font-semibold text-gray-900 dark:text-white text-sm">
          {header}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          {footer}
        </div>
      )}
    </div>
  );
}
