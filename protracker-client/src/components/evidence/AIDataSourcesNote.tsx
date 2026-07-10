import { useTranslation } from 'react-i18next';
import { Check, X, Database } from 'lucide-react';
import { clsx } from 'clsx';
import { usePlayerAssessments } from '../../hooks/useAssessments';
import {
  usePlayerObjectiveTests, usePlayerMatchStats, usePlayerSelfAssessments,
} from '../../hooks/useEvidence';

interface Props {
  playerId: number | null | undefined;
  className?: string;
}

// Shown next to AI generate buttons: exactly which data the AI will draw on, so
// coaches see the value of collecting evidence (and what's still missing).
export function AIDataSourcesNote({ playerId, className }: Props) {
  const { t } = useTranslation();
  const { data: assessments = [] } = usePlayerAssessments(playerId ?? undefined);
  const { data: tests = [] } = usePlayerObjectiveTests(playerId);
  const { data: matchStats = [] } = usePlayerMatchStats(playerId);
  const { data: selfAssessments = [] } = usePlayerSelfAssessments(playerId);

  if (!playerId) return null;

  const rows = [
    { count: assessments.length, label: t('evidence.aiSourceAssessments', '{{count}} assessment records', { count: assessments.length }) },
    { count: tests.length, label: t('evidence.aiSourceTests', '{{count}} objective test results', { count: tests.length }) },
    { count: matchStats.length, label: t('evidence.aiSourceMatchStats', '{{count}} match stat entries', { count: matchStats.length }) },
    { count: selfAssessments.length, label: t('evidence.aiSourceSelfAssess', '{{count}} self-assessments', { count: selfAssessments.length }) },
  ];

  return (
    <div className={clsx('rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-3', className)}>
      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
        <Database size={11} /> {t('evidence.aiUsingData', 'The AI will use')}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {rows.map(row => (
          <span key={row.label} className="flex items-center gap-1 text-xs">
            {row.count > 0
              ? <Check size={12} className="text-emerald-500" />
              : <X size={12} className="text-gray-400" />}
            <span className={row.count > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}>
              {row.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
