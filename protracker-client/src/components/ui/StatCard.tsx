import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  className?: string;
  gradient?: string;
}

export function StatCard({ title, value, icon, trend, className, gradient }: Props) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md transition-all',
        className
      )}
    >
      {gradient && (
        <div className={clsx('absolute inset-0 opacity-5', gradient)} />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {title}
          </p>
          {icon && (
            <div className="text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
              {icon}
            </div>
          )}
        </div>
        <p className="text-3xl font-black text-gray-900 dark:text-white">
          {value}
        </p>
        {trend && (
          <div className={clsx(
            'flex items-center gap-1 mt-2 text-xs font-medium',
            trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
          )}>
            {trend.value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend.value)}% {trend.label}
          </div>
        )}
      </div>
    </div>
  );
}
