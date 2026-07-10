import { Link } from 'react-router-dom';
import { Target, ChevronRight, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import { useMyGoals } from '../../hooks/useGoals';
import { completionPercent, progressColor, daysUntil } from './goalUtils';
import type { PersonalGoal } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

// A goal is "on track" when it's active and not past its target date.
function onTrack(g: PersonalGoal): boolean {
  return g.status === 'Active' && (!g.targetDate || daysUntil(g.targetDate) >= 0);
}

export function GoalsMiniCard({ goalsPath }: { goalsPath: string }) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { data: goals = [], isLoading } = useMyGoals();

  const active = goals.filter(g => g.status === 'Active');
  const onTrackCount = active.filter(onTrack).length;
  const top = active.slice(0, 3);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="inline-flex p-2 rounded-xl bg-indigo-500/10">
            <Target size={16} className="text-indigo-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('goals.title', 'My Goals')}</h2>
        </div>
        <Link to={goalsPath} className="flex items-center gap-0.5 text-sm font-medium text-indigo-500 hover:underline">
          {t('common.viewAll', 'View All')} <ChevronRight size={15} />
        </Link>
      </div>

      {isLoading ? (
        <div className="h-16 skeleton rounded-xl" />
      ) : active.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('goals.noActiveGoals', 'No active goals yet.')}</p>
          <Link to={goalsPath} className="mt-2 inline-block text-sm font-semibold text-indigo-500 hover:underline">{t('goals.setFirstGoal', 'Set your first goal →')}</Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            <span className="font-semibold text-gray-900 dark:text-white">{t('goals.xOfY', '{{count}} of {{total}}', { count: onTrackCount, total: active.length })}</span> {t('goals.goalsOnTrack', 'goals on track')}
          </p>
          <div className="space-y-3">
            {top.map(g => {
              const pct = completionPercent(g);
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex items-center gap-1.5">
                      {g.status === 'Achieved' && <Trophy size={13} className="text-green-500 flex-shrink-0" />}
                      {g.title}
                    </span>
                    {pct != null && <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">{pct}%</span>}
                  </div>
                  {pct != null ? (
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={clsx('h-full rounded-full', progressColor(pct))} style={{ width: `${pct}%` }} />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">{L.category(g.category)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
