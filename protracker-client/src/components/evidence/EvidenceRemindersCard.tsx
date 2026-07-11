import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ShieldCheck, X } from 'lucide-react';
import { useEvidenceReminders } from '../../hooks/useEvidence';

type Frequency = 'daily' | 'weekly' | 'off';

const FREQ_KEY = 'pt_evidence_reminder_freq';
const DISMISSED_KEY = 'pt_evidence_reminder_dismissed';

function getFrequency(): Frequency {
  const v = localStorage.getItem(FREQ_KEY);
  return v === 'weekly' || v === 'off' ? v : 'daily';
}

function isSnoozed(freq: Frequency): boolean {
  if (freq === 'off') return true;
  const at = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
  const windowMs = freq === 'daily' ? 24 * 3600_000 : 7 * 24 * 3600_000;
  return Date.now() - at < windowMs;
}

// Coach-dashboard nudges: stale objective tests + players stuck on Low-confidence
// estimates. Dismissal snoozes per the chosen frequency (daily / weekly / off).
export function EvidenceRemindersCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: reminders = [] } = useEvidenceReminders();
  const [freq, setFreq] = useState<Frequency>(getFrequency);
  const [snoozed, setSnoozed] = useState(() => isSnoozed(getFrequency()));

  if (snoozed || reminders.length === 0) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setSnoozed(true);
  }

  function changeFreq(next: Frequency) {
    localStorage.setItem(FREQ_KEY, next);
    setFreq(next);
    if (next === 'off') setSnoozed(true);
  }

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <ShieldCheck size={15} className="text-indigo-500" />
        <h3 className="font-bold text-gray-900 dark:text-white text-sm flex-1">
          {t('evidence.remindersTitle', 'Evidence Reminders')}
        </h3>
        <select
          value={freq}
          onChange={e => changeFreq(e.target.value as Frequency)}
          className="text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 cursor-pointer"
          aria-label={t('evidence.reminderFrequency', 'Reminder frequency')}
        >
          <option value="daily">{t('evidence.freqDaily', 'Daily')}</option>
          <option value="weekly">{t('evidence.freqWeekly', 'Weekly')}</option>
          <option value="off">{t('evidence.freqOff', 'Off')}</option>
        </select>
        <button type="button" onClick={dismiss}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
          aria-label={t('common.dismiss', 'Dismiss')}>
          <X size={14} />
        </button>
      </div>

      <div className="space-y-1.5">
        {reminders.map((r, i) => (
          <button
            key={i}
            type="button"
            onClick={() => r.playerId != null ? navigate(`/players/${r.playerId}`) : undefined}
            className="w-full flex items-center gap-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <FlaskConical size={12} className="text-amber-500 flex-shrink-0" />
            <span className="truncate">
              {r.type === 'NoRecentTest'
                ? (r.daysSinceTest != null
                    ? t('evidence.reminderStaleTest', "{{name}} hasn't had an objective test in {{days}} days", { name: r.playerName, days: r.daysSinceTest })
                    : t('evidence.reminderNeverTested', "{{name}} hasn't had an objective test yet", { name: r.playerName }))
                : t('evidence.reminderLowConfidence', '{{count}} players have Low confidence scores — add objective tests to improve accuracy', { count: r.count ?? 0 })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
