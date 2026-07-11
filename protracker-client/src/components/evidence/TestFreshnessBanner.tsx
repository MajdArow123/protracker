import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info } from 'lucide-react';
import type { EvidenceBasedScore } from '../../types';

// Freshness gate messaging: High confidence requires an objective test in the last
// 60 days. Amber = the test expired; blue = never tested. Nothing renders for
// rating-only metrics or when a fresh test exists.
export function TestFreshnessBanner({ score }: { score: EvidenceBasedScore }) {
  const { t } = useTranslation();
  if (!score.isObjectiveTestable) return null;

  if (score.daysSinceObjectiveTest == null) {
    return (
      <div className="rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-900/30 p-2.5 flex items-start gap-2">
        <Info size={13} className="text-sky-500 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-sky-800 dark:text-sky-300 leading-snug">
          <p className="font-bold">{t('evidence.noTestYetTitle', 'No objective test recorded yet')}</p>
          <p>{t('evidence.noTestYetHint', 'Add a measured test to unlock High confidence.')}</p>
        </div>
      </div>
    );
  }

  if (!score.isObjectiveTestExpired) return null;

  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-2.5 flex items-start gap-2">
      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
        <p className="font-bold">{t('evidence.testRequiredTitle', 'Objective test required for High confidence')}</p>
        <p>{t('evidence.testExpiredLine', 'Last test: {{days}} days ago (expired)', { days: score.daysSinceObjectiveTest })}</p>
        <p>{t('evidence.testExpiredHint', 'Run a new test to restore High confidence.')}</p>
      </div>
    </div>
  );
}
