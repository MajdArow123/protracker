import { AlertCircle, RotateCw } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  /** What failed to load, e.g. "dashboard", "players". */
  thing?: string;
  message?: string;
  onRetry?: () => void;
  size?: 'sm' | 'md';
}

// Consistent inline error state: red AlertCircle, a friendly message, and a Retry
// button wired to the query's refetch.
export function ErrorState({ thing = 'data', message, onRetry, size = 'md' }: Props) {
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', size === 'sm' ? 'py-8' : 'py-14')}>
      <div className="inline-flex p-3 rounded-2xl bg-red-500/10 mb-4">
        <AlertCircle size={size === 'sm' ? 24 : 30} className="text-red-500" />
      </div>
      <h3 className="font-bold text-gray-700 dark:text-gray-300">
        {message ?? `Failed to load ${thing}.`}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Please try again.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
        >
          <RotateCw size={15} /> Retry
        </button>
      )}
    </div>
  );
}
