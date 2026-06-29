import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({ icon, title, description, action, size = 'md' }: Props) {
  return (
    <div className={clsx(
      'flex flex-col items-center justify-center text-center',
      size === 'sm' && 'py-8',
      size === 'md' && 'py-12',
      size === 'lg' && 'py-20',
    )}>
      {icon && (
        <div className="text-gray-300 dark:text-gray-700 mb-4 opacity-60">
          {icon}
        </div>
      )}
      <h3 className={clsx(
        'font-bold text-gray-700 dark:text-gray-300',
        size === 'sm' ? 'text-base' : 'text-lg',
      )}>
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/20 cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
