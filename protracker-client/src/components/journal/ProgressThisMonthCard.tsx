import { useMemo } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { useMyJournal } from '../../hooks/useJournal';
import { useMyGoals } from '../../hooks/useGoals';
import { dateKey } from './journalUtils';
import { useTranslation } from 'react-i18next';

// Consecutive days ending today (or yesterday) that have a journal entry.
function journalStreak(dates: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to hold if today isn't written yet but yesterday was.
  if (!dates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function ProgressThisMonthCard() {
  const { t } = useTranslation();
  const { data: entries = [] } = useMyJournal(90);
  const { data: goals = [] } = useMyGoals();

  const streak = useMemo(
    () => journalStreak(new Set(entries.map(e => dateKey(new Date(e.entryDate))))),
    [entries],
  );

  const achievedThisMonth = useMemo(() => {
    const now = new Date();
    return goals.filter(g =>
      g.status === 'Achieved' && g.achievedAt &&
      new Date(g.achievedAt).getMonth() === now.getMonth() &&
      new Date(g.achievedAt).getFullYear() === now.getFullYear(),
    ).length;
  }, [goals]);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">{t('journal.progressThisMonth', 'Progress this month')}</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Flame size={20} className={streak > 0 ? 'text-orange-500' : 'text-gray-400'} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{streak}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('journal.journalStreak', 'Journal streak')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <Trophy size={20} className={achievedThisMonth > 0 ? 'text-green-500' : 'text-gray-400'} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{achievedThisMonth}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('journal.goalsAchieved', 'Goals achieved')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
