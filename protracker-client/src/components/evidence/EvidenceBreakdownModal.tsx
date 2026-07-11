import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical, BarChart2, UserCheck, User, Lightbulb, HelpCircle } from 'lucide-react';
import { TestProtocolModal } from './TestProtocolModal';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { scoreColor } from '../assessments/ScoreWidgets';
import { EvidencePanel } from './EvidencePanel';
import { confidenceBadgeClass, confidenceLabel, translateEvidenceItem } from './evidenceUtils';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import {
  usePlayerObjectiveTests, usePlayerCoachEvaluations,
  usePlayerSelfAssessments, usePlayerMatchStats,
} from '../../hooks/useEvidence';
import type { SportMetricDefinition, EvidenceBasedScore } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  playerId: number;
  metric: SportMetricDefinition;
  score: EvidenceBasedScore | null;
  self?: boolean;
  teamId?: number | null;
  /** Hide entry forms for read-only viewers (e.g. team athlete looking at own data). */
  readOnly?: boolean;
  /** Team athletes may not record match stats (coach/solo only on the backend). */
  canEnterMatchStats?: boolean;
}

interface TimelineItem {
  date: string;
  icon: typeof FlaskConical;
  color: string;
  text: string;
}

// Full breakdown of how one metric's evidence-based score was calculated: per-source
// bars, plain-English explanation, evidence history and what's missing.
export function EvidenceBreakdownModal({ isOpen, onClose, playerId, metric, score, self, teamId, readOnly, canEnterMatchStats = true }: Props) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocaleFormat();
  const [showProtocol, setShowProtocol] = useState(false);

  const { data: tests = [] } = usePlayerObjectiveTests(playerId, metric.id, isOpen);
  const { data: coachEvals = [] } = usePlayerCoachEvaluations(playerId, isOpen);
  const { data: selfAssessments = [] } = usePlayerSelfAssessments(playerId, isOpen);
  const { data: matchStats = [] } = usePlayerMatchStats(playerId, isOpen && metric.supportsMatchStats);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...tests.map(x => ({
        date: x.testedAt,
        icon: FlaskConical,
        color: 'text-indigo-500',
        text: t('evidence.timelineTest', 'Test: {{value}} {{unit}} (scores {{score}}/10)', {
          value: formatNumber(x.value), unit: x.unit, score: x.normalizedScore.toFixed(1),
        }),
      })),
      ...coachEvals.filter(x => x.metricDefinitionId === metric.id).map(x => ({
        date: x.evalDate,
        icon: UserCheck,
        color: 'text-emerald-500',
        text: t('evidence.timelineCoachEval', 'Coach evaluation — {{rating}}/10', { rating: x.rating.toFixed(1) }),
      })),
      ...selfAssessments.filter(x => x.metricDefinitionId === metric.id).map(x => ({
        date: x.evalDate,
        icon: User,
        color: 'text-amber-500',
        text: t('evidence.timelineSelfAssess', 'Self-assessment — {{rating}}/10', { rating: x.rating.toFixed(1) }),
      })),
      ...(metric.supportsMatchStats ? matchStats.map(x => ({
        date: x.statDate,
        icon: BarChart2,
        color: 'text-sky-500',
        text: t('evidence.timelineMatchStats', 'Match stats recorded'),
      })) : []),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  }, [tests, coachEvals, selfAssessments, matchStats, metric, t, formatNumber]);

  const rows = score ? [
    { label: t('evidence.sourceObjective', 'Objective test'), value: score.objectiveScore, weight: score.objectiveWeight, baseWeight: metric.objectiveTestWeight },
    { label: t('evidence.sourceMatchStats', 'Match stats'), value: score.matchStatScore, weight: score.matchStatWeight, baseWeight: metric.matchStatWeight },
    { label: t('evidence.sourceCoachEval', 'Coach evaluation'), value: score.coachEvalScore, weight: score.coachEvalWeight, baseWeight: metric.coachEvalWeight },
    { label: self ? t('evidence.tabSelfEval', 'Self Evaluation') : t('evidence.sourceSelfAssess', 'Self-assessment'), value: score.selfAssessScore, weight: score.selfAssessWeight, baseWeight: metric.selfAssessWeight },
  ].filter(r => r.baseWeight > 0 || r.value !== null) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={score
        ? `${metric.name} — ${score.finalScore.toFixed(1)}/10`
        : metric.name}
      size="lg"
    >
      <div className="space-y-5">
        {score ? (
          <>
            {/* Source breakdown */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2.5">
              {rows.map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-32 flex-shrink-0 truncate">{row.label}</span>
                  {row.value !== null ? (
                    <>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(row.value / 10) * 100}%`, background: scoreColor(row.value) }} />
                      </div>
                      <span className="text-sm font-bold w-9 text-right" style={{ color: scoreColor(row.value) }}>{row.value.toFixed(1)}</span>
                      <span className="text-[11px] text-gray-400 w-10 text-right">{Math.round(row.weight * 100)}%</span>
                    </>
                  ) : (
                    <span className="flex-1 text-xs text-gray-400 italic">{t('evidence.missing', 'missing')}</span>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('evidence.weightedScore', 'Weighted score')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black" style={{ color: scoreColor(score.finalScore) }}>{score.finalScore.toFixed(1)}/10</span>
                  <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full', confidenceBadgeClass(score.confidence))}>
                    {confidenceLabel(score.confidence, t)}
                  </span>
                </div>
              </div>
            </div>

            {score.explanation && (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{score.explanation}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('evidence.noScoreYet', 'No evidence recorded for this metric yet. Add a first piece of evidence below.')}
          </p>
        )}

        {/* Evidence history */}
        {timeline.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('evidence.historyTitle', 'Evidence history')}
            </h4>
            <div className="space-y-1.5">
              {timeline.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs">
                  <item.icon size={13} className={clsx('flex-shrink-0', item.color)} />
                  <span className="text-gray-400 w-16 flex-shrink-0">{formatDate(item.date, { month: 'short', day: 'numeric' })}</span>
                  <span className="text-gray-600 dark:text-gray-300 truncate">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What would improve this score */}
        {score && score.missingEvidence.length > 0 && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-3">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1.5">
              <Lightbulb size={13} /> {t('evidence.improveTitle', 'What would improve this score?')}
            </p>
            <ul className="space-y-0.5">
              {score.missingEvidence.map(m => (
                <li key={m} className="text-xs text-amber-800 dark:text-amber-300">
                  • {t('evidence.missingItem', 'Missing: {{what}}', { what: translateEvidenceItem(m, t) })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Test protocol guide */}
        {(metric.testSetup || metric.testProcedure) && (
          <button
            type="button"
            onClick={() => setShowProtocol(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            <HelpCircle size={13} /> {t('evidence.viewProtocol', 'View test protocol')}
          </button>
        )}

        {showProtocol && (
          <TestProtocolModal isOpen={showProtocol} onClose={() => setShowProtocol(false)} metric={metric} />
        )}

        {/* Inline evidence entry */}
        {!readOnly && (
          <EvidencePanel
            playerId={playerId}
            metric={metric}
            score={score ?? undefined}
            self={self}
            teamId={teamId}
            canEnterMatchStats={canEnterMatchStats}
          />
        )}
      </div>
    </Modal>
  );
}
