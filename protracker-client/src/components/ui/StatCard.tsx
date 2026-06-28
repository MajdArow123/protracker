import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface Props {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: Props) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        {icon && (
          <div className="text-indigo-600 dark:text-indigo-400">{icon}</div>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {trend && (
        <p
          className={clsx(
            'mt-1 text-xs',
            trend.value >= 0 ? 'text-green-600' : 'text-red-600'
          )}
        >
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%{' '}
          {trend.label}
        </p>
      )}
    </div>
  );
}
