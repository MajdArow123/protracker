import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Check, ChevronDown, Circle, UserCog, X } from 'lucide-react';
import type { ProfileCompletion } from '../../utils/profileCompletion';

const DISMISS_KEY = 'protracker_completion_reminder_dismissed';
const DISMISS_DAYS = 7;

function isReminderDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - new Date(raw).getTime() < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// Athlete-dashboard nudge shown while the profile is under 80% complete.
// Collapsed to a single line by default so it never outranks the actual
// dashboard content (it used to fill the whole first screen on phones);
// expands on tap. Dismissing hides it for 7 days. The bar is indigo — an
// incomplete profile is progress toward a goal, not an error state.
export function ProfileCompletionReminder({ completion }: { completion: ProfileCompletion }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(isReminderDismissed());
  const [expanded, setExpanded] = useState(false);

  if (dismissed || completion.percent >= 80) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, new Date().toISOString()); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20">
      {/* Collapsed one-line summary — always visible */}
      <div className="flex items-center gap-3 p-3 pl-4">
        <div className="p-1.5 rounded-lg bg-indigo-500/15 flex-shrink-0">
          <UserCog size={14} className="text-indigo-500" />
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
        >
          <span className="text-sm font-bold text-gray-900 dark:text-white flex-shrink-0">
            {t('profile.completion.reminderTitle', 'Complete your profile')}
          </span>
          <span className="hidden sm:block flex-1 h-1.5 rounded-full bg-white dark:bg-gray-800 overflow-hidden">
            <span className="block h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${completion.percent}%` }} />
          </span>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex-shrink-0">{completion.percent}%</span>
          <ChevronDown size={14} className={clsx('text-gray-400 flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
        </button>
        <button onClick={dismiss} aria-label={t('profile.completion.dismissAria', 'Dismiss for 7 days')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer flex-shrink-0">
          <X size={15} />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t('profile.completion.reminderSubtitle', '{{percent}}% done — a complete profile helps your coach plan for you.', { percent: completion.percent })}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
            {completion.items.slice(0, 8).map(item => (
              <div key={item.key} className={clsx('flex items-center gap-2 text-xs', item.done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-600 dark:text-gray-300')}>
                {item.done
                  ? <Check size={12} className="text-green-500 flex-shrink-0" />
                  : <Circle size={11} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
                <span className="truncate">{t(item.key, item.label)}</span>
                {!item.done && <span className="text-indigo-500 font-semibold flex-shrink-0">+{item.points}%</span>}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/player-dashboard/profile')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            {t('profile.completion.completeNow', 'Complete Now')}
          </button>
        </div>
      )}
    </div>
  );
}
