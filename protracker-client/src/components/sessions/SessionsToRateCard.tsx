import { useState } from 'react';
import { clsx } from 'clsx';
import { Star, CalendarDays, CheckCircle2, ChevronRight } from 'lucide-react';
import { useMySessionFeedback } from '../../hooks/useSessionFeedback';
import { SessionFeedbackModal } from './SessionFeedbackModal';
import type { MySessionFeedback } from '../../types';

const TYPE_LABEL: Record<string, string> = {
  Training: 'Training', MatchPrep: 'Match Prep', Recovery: 'Recovery',
  Strength: 'Strength', Tactical: 'Tactical', Other: 'Other',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Athlete card: prompts feedback on recent sessions that haven't been rated yet.
// Renders nothing when there are no past sessions at all.
export function SessionsToRateCard({ enabled = true }: { enabled?: boolean }) {
  const { data: rows = [] } = useMySessionFeedback(enabled);
  const [active, setActive] = useState<MySessionFeedback | null>(null);

  if (rows.length === 0) return null;

  const pending = rows.filter(r => !r.feedback).slice(0, 5);
  const ratedCount = rows.length - rows.filter(r => !r.feedback).length;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star size={18} className="text-amber-500" />
          <h2 className="font-bold text-gray-900 dark:text-white">Rate your sessions</h2>
        </div>
        {pending.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {pending.length} to rate
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
          <CheckCircle2 size={16} className="text-emerald-500" />
          All caught up — you've rated your recent sessions.
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(row => (
            <button
              key={row.session.id}
              onClick={() => setActive(row)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-all text-left cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                <CalendarDays size={16} className="text-indigo-600 dark:text-indigo-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate text-sm">{row.session.title}</div>
                <div className="text-xs text-gray-500">
                  {fmtDate(row.session.startTime)} · {TYPE_LABEL[row.session.sessionType] ?? row.session.sessionType}
                </div>
              </div>
              <span className="hidden sm:inline text-xs font-semibold text-indigo-600 dark:text-indigo-400">Rate</span>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {ratedCount > 0 && (
        <p className={clsx('text-[11px] text-gray-400 mt-3', pending.length === 0 && 'mt-0')}>
          {ratedCount} session{ratedCount > 1 ? 's' : ''} rated so far.
        </p>
      )}

      <SessionFeedbackModal
        session={active?.session ?? null}
        existing={active?.feedback ?? null}
        isOpen={!!active}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
