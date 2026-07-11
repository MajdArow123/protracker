import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { CountUp } from '../ui/CountUp';

interface Props {
  title: string;
  /** Numeric value animates with CountUp; pass `valueNode` instead for custom content. */
  value?: number;
  decimals?: number;
  valueNode?: ReactNode;
  icon: LucideIcon;
  /** Tailwind gradient stops for the icon chip + glow blob, e.g. 'from-blue-500 to-indigo-600'. */
  gradient: string;
  valueClassName?: string;
  /** Rendered under the value (sparkline, hint text…). */
  footer?: ReactNode;
}

// Glass-morphism dashboard stat card: translucent blurred surface, a soft
// gradient glow behind the icon corner, gradient icon chip, animated number.
export function StatCard({ title, value, decimals = 0, valueNode, icon: Icon, gradient, valueClassName, footer }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 dark:border-gray-800/80 bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl p-5 group hover:border-gray-300 dark:hover:border-gray-700 transition-all">
      <div
        className={clsx(
          'absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br opacity-[0.13] blur-2xl pointer-events-none group-hover:opacity-25 transition-opacity',
          gradient,
        )}
      />
      <div className={clsx('relative inline-flex p-2.5 rounded-xl mb-3 bg-gradient-to-br text-white shadow-lg', gradient)}>
        <Icon size={18} />
      </div>
      <p className="relative text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
      <div className="relative flex items-end justify-between gap-2">
        {valueNode ?? (
          <CountUp
            value={value ?? 0}
            decimals={decimals}
            className={clsx('text-3xl font-black mt-0.5 block tabular-nums', valueClassName ?? 'text-gray-900 dark:text-white')}
          />
        )}
        {footer}
      </div>
    </div>
  );
}
