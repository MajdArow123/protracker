import { Link } from 'react-router-dom';
import { BookOpen, PenLine, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useTodayJournal } from '../../hooks/useJournal';
import { MOOD_CONFIG } from './journalUtils';

// Athlete/solo dashboard nudge: prompts today's entry, or celebrates that it's done.
export function JournalPromptCard({ journalPath }: { journalPath: string }) {
  const { data: today, isLoading } = useTodayJournal();

  if (isLoading) return <div className="h-[92px] skeleton rounded-2xl" />;

  if (today) {
    const cfg = MOOD_CONFIG[today.mood];
    const Icon = cfg.icon;
    return (
      <Link
        to={journalPath}
        className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
      >
        <div className={clsx('flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center', cfg.bg)}>
          <Icon size={20} className={cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white">Good job writing today! 📖</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">You logged a <span className={cfg.color}>{today.mood.toLowerCase()}</span> day. View your journal.</p>
        </div>
        <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      to={journalPath}
      className="flex items-center gap-3 rounded-2xl border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 p-5 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/30 transition-colors"
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
        <PenLine size={20} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white">Write today's entry</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Reflect on your training and how you're feeling.</p>
      </div>
      <BookOpen size={18} className="text-indigo-400 flex-shrink-0" />
    </Link>
  );
}
