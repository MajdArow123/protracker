import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { Check, Circle } from 'lucide-react';
import type { ProfileCompletion } from '../../utils/profileCompletion';

export function ProfileCompletionCard({ completion }: { completion: ProfileCompletion }) {
  const { t } = useTranslation();
  const { percent, missing } = completion;
  if (percent >= 100) return null; // nothing to nag about

  const barColor = percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t('profile.completion.title', 'Profile {{percent}}% complete', { percent })}</h3>
        <span className={clsx(
          'text-xs font-bold px-2 py-0.5 rounded-full',
          percent >= 80 ? 'bg-green-500/10 text-green-500' : percent >= 50 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500',
        )}>
          {percent}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-3">
        <div className={clsx('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${percent}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {missing.map(item => (
          <div key={item.key} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Circle size={11} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
            <span className="truncate">{t(item.key, item.label)}</span>
            <span className="text-indigo-500 font-semibold flex-shrink-0">+{item.points}%</span>
          </div>
        ))}
        {completion.items.filter(i => i.done).slice(0, 2).map(item => (
          <div key={item.key} className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 line-through">
            <Check size={11} className="text-green-500 flex-shrink-0" />
            <span className="truncate">{t(item.key, item.label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
