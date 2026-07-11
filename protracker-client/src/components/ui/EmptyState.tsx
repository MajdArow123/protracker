import { useId, type ReactNode } from 'react';
import { clsx } from 'clsx';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({ icon, title, description, action, size = 'md' }: Props) {
  const glowId = useId();
  return (
    <div className={clsx(
      'flex flex-col items-center justify-center text-center',
      size === 'sm' && 'py-8',
      size === 'md' && 'py-12',
      size === 'lg' && 'py-20',
    )}>
      {icon && (
        <div className="relative flex items-center justify-center mb-4">
          {/* Decorative backdrop: soft gradient disc + dashed orbit ring */}
          <svg
            width={size === 'sm' ? 88 : 108}
            height={size === 'sm' ? 88 : 108}
            viewBox="0 0 108 108"
            className="absolute"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id={`empty-glow-${glowId}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </radialGradient>
            </defs>
            <circle cx="54" cy="54" r="52" fill={`url(#empty-glow-${glowId})`} />
            <circle
              cx="54" cy="54" r="42"
              fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeDasharray="3 7" strokeLinecap="round"
              className="text-gray-300 dark:text-gray-700"
            />
            <circle cx="54" cy="12" r="2.5" className="fill-indigo-400/60" />
            <circle cx="90" cy="72" r="2" className="fill-indigo-300/50 dark:fill-indigo-600/50" />
          </svg>
          <div className="relative text-gray-300 dark:text-gray-600">
            {icon}
          </div>
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
