import { clsx } from 'clsx';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

export function Spinner({ size = 'md', className }: Props) {
  return (
    <svg
      className={clsx('animate-spin text-indigo-600', sizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 animate-pulse">
      <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded-full mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={clsx('h-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-2', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
