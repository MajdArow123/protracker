import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { scoreColor } from '../assessments/scoreDisplay';
import { confidenceBadgeClass, confidenceLabel, confidenceExplanation, toSliderStep, translateEvidenceItem } from './evidenceUtils';
import { TestFreshnessBanner } from './TestFreshnessBanner';
import type { EvidenceBasedScore } from '../../types';
import type { TFunction } from 'i18next';

interface Props {
  score: EvidenceBasedScore;
  /** When set, shows "Apply this score" which pushes the value onto the slider. */
  onApply?: (value: number) => void;
  compact?: boolean;
}

function sourceRows(s: EvidenceBasedScore, t: TFunction) {
  return [
    { label: t('evidence.sourceObjective', 'Objective test'), value: s.objectiveScore, weight: s.objectiveWeight },
    { label: t('evidence.sourceMatchStats', 'Match stats'), value: s.matchStatScore, weight: s.matchStatWeight },
    { label: t('evidence.sourceCoachEval', 'Coach evaluation'), value: s.coachEvalScore, weight: s.coachEvalWeight },
    { label: t('evidence.sourceSelfAssess', 'Self-assessment'), value: s.selfAssessScore, weight: s.selfAssessWeight },
  ];
}

// Live preview of the calculated evidence-based score with its source breakdown.
export function ScorePreviewCard({ score, onApply, compact }: Props) {
  const { t } = useTranslation();
  const color = scoreColor(score.finalScore);

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-900/10 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          {t('evidence.calculatedScore', 'Calculated score')}
        </p>
        <span
          className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-help', confidenceBadgeClass(score.confidence))}
          title={confidenceExplanation(score, t)}
        >
          {t('evidence.confidenceBadge', '{{level}} confidence', { level: confidenceLabel(score.confidence, t) })}
        </span>
      </div>

      <TestFreshnessBanner score={score} />

      <div className="flex items-center gap-3">
        <span className="text-2xl font-black" style={{ color }}>{score.finalScore.toFixed(1)}</span>
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(score.finalScore / 10) * 100}%`, background: color }} />
        </div>
        <span className="text-xs text-gray-400 font-medium">/10</span>
      </div>

      {!compact && (
        <div className="space-y-1">
          {sourceRows(score, t).map(row => {
            const present = row.value !== null;
            return (
              <div key={row.label} className="flex items-center gap-2 text-xs">
                {present
                  ? <Check size={12} className="text-emerald-500 flex-shrink-0" />
                  : <X size={12} className="text-gray-400 flex-shrink-0" />}
                <span className={clsx('flex-1 truncate', present ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 line-through-none')}>
                  {row.label}
                </span>
                {present ? (
                  <>
                    <span className="font-bold" style={{ color: scoreColor(row.value!) }}>{row.value!.toFixed(1)}</span>
                    <span className="text-gray-400 w-9 text-right">{Math.round(row.weight * 100)}%</span>
                  </>
                ) : (
                  <span className="text-gray-400">{t('evidence.missing', 'missing')}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {score.missingEvidence.length > 0 && (
        <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
          {t('evidence.addToImprove', 'Add {{what}} to raise confidence', {
            what: translateEvidenceItem(score.missingEvidence[0], t),
          })}
        </p>
      )}

      {onApply && (
        <button
          type="button"
          onClick={() => onApply(toSliderStep(score.finalScore))}
          className="w-full text-center text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-1.5 transition-colors cursor-pointer"
        >
          {t('evidence.applyScore', 'Apply {{value}} to the slider', { value: toSliderStep(score.finalScore).toFixed(1) })}
        </button>
      )}
    </div>
  );
}
