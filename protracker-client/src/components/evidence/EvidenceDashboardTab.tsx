import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, FlaskConical, BarChart2, UserCheck, User, ShieldCheck, Plus, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { CardListSkeleton } from '../ui/Skeleton';
import { scoreColor } from '../assessments/ScoreWidgets';
import { EvidenceBreakdownModal } from './EvidenceBreakdownModal';
import { EvidenceAnalysisModal } from './EvidenceAnalysisModal';
import { TestResultsSection } from './TestResultsSection';
import { MatchStatsSection } from './MatchStatsSection';
import { confidenceBadgeClass, confidenceLabel, confidenceExplanation, overallConfidence } from './evidenceUtils';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { useSportMetrics, usePlayerEvidenceScores, useRecalculateEvidence } from '../../hooks/useEvidence';
import { usePlayerBenchmarks } from '../../hooks/useBenchmarks';
import { useToast } from '../../context/ToastContext';
import type { SportMetricDefinition, EvidenceBasedScore } from '../../types';

interface Props {
  playerId: number;
  sportId: number | null | undefined;
  /** Athlete/solo viewing themselves: guided entry saves self-assessments. */
  self?: boolean;
  teamId?: number | null;
  /** Team athlete looking at own data: browse only, no entry forms. */
  readOnly?: boolean;
  /** Team athletes may not record match stats (coach/solo only on the backend). */
  canEnterMatchStats?: boolean;
  /** AI endpoints are Coach/Admin/SoloAthlete only — hides the AI quality report otherwise. */
  canUseAI?: boolean;
}

const SOURCE_ICONS = [
  { icon: FlaskConical, key: 'objectiveScore' as const, color: 'text-indigo-500' },
  { icon: BarChart2, key: 'matchStatScore' as const, color: 'text-sky-500' },
  { icon: UserCheck, key: 'coachEvalScore' as const, color: 'text-emerald-500' },
  { icon: User, key: 'selfAssessScore' as const, color: 'text-amber-500' },
];

// The complete evidence picture for one player: overall summary + a card per sport
// metric with score, confidence and evidence sources. Click-through to the breakdown.
export function EvidenceDashboardTab({ playerId, sportId, self = false, teamId, readOnly, canEnterMatchStats = true, canUseAI = false }: Props) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const { addToast } = useToast();

  const { data: metrics = [], isLoading: loadingMetrics } = useSportMetrics(sportId);
  const { data: scores = [], isLoading: loadingScores } = usePlayerEvidenceScores(playerId);
  const { data: benchmarks } = usePlayerBenchmarks(playerId);
  const recalculate = useRecalculateEvidence();

  const [selected, setSelected] = useState<SportMetricDefinition | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const scoreByMetric = useMemo(() => {
    const map = new Map<number, EvidenceBasedScore>();
    for (const s of scores) map.set(s.metricDefinitionId, s);
    return map;
  }, [scores]);

  const overall = overallConfidence(scores);
  const lastUpdated = scores.length
    ? scores.reduce((max, s) => (s.lastCalculatedAt > max ? s.lastCalculatedAt : max), scores[0].lastCalculatedAt)
    : null;
  const missingCount = metrics.length - scores.length
    + scores.reduce((n, s) => n + (s.missingEvidence.length > 0 ? 1 : 0), 0);

  async function refresh() {
    try {
      await recalculate.mutateAsync(playerId);
      addToast(t('evidence.recalculated', 'Scores recalculated'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error', 'Failed'), 'error');
    }
  }

  if (loadingMetrics || loadingScores) return <CardListSkeleton count={6} />;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {benchmarks?.profileName && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 w-full sm:w-auto sm:order-last"
            title={t('evidence.calibratedFor', 'Scores calibrated for {{profile}}', { profile: benchmarks.profileName })}
          >
            {t('evidence.benchmarkBadge', '{{profile}} benchmarks', { profile: benchmarks.profileName })}
          </span>
        )}
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-indigo-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('evidence.overallConfidence', 'Overall confidence')}</p>
            {overall ? (
              <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-0.5', confidenceBadgeClass(overall))}>
                {confidenceLabel(overall, t)}
              </span>
            ) : (
              <p className="text-sm font-bold text-gray-400">{t('evidence.noEvidenceYet', 'No evidence yet')}</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('evidence.scoredMetrics', 'Metrics with evidence')}</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{scores.length} / {metrics.length}</p>
        </div>
        {lastUpdated && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('evidence.lastUpdated', 'Last updated')}</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {formatDate(lastUpdated, { month: 'short', day: 'numeric' })}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('evidence.missingEvidenceCount', 'Needs more evidence')}</p>
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{missingCount}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canUseAI && (
            <Button type="button" size="sm" onClick={() => setShowAnalysis(true)}>
              <Sparkles size={13} /> {t('evidence.qualityReport', 'AI Quality Report')}
            </Button>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={refresh} isLoading={recalculate.isPending}>
            <RefreshCw size={13} /> {t('evidence.recalculate', 'Recalculate')}
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {metrics.map(metric => {
          const score = scoreByMetric.get(metric.id) ?? null;
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() => setSelected(metric)}
              className="text-left rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{metric.name}</p>
                {score ? (
                  <span className="text-lg font-black flex-shrink-0" style={{ color: scoreColor(score.finalScore) }}>
                    {score.finalScore.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-lg font-black text-gray-300 dark:text-gray-700 flex-shrink-0">—</span>
                )}
              </div>

              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2.5">
                {score && (
                  <div className="h-full rounded-full" style={{ width: `${(score.finalScore / 10) * 100}%`, background: scoreColor(score.finalScore) }} />
                )}
              </div>

              <div className="flex items-center gap-2">
                {score ? (
                  <>
                    <span
                      className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-help', confidenceBadgeClass(score.confidence))}
                      title={confidenceExplanation(score, t)}
                    >
                      {confidenceLabel(score.confidence, t)}
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      {SOURCE_ICONS.filter(s => score[s.key] !== null).map(s => (
                        <s.icon key={s.key} size={12} className={s.color} />
                      ))}
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-indigo-500 font-medium">
                    <Plus size={11} /> {t('evidence.addEvidence', 'Add evidence')}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Trends: test history + aggregated match stats (render only when data exists) */}
      <TestResultsSection playerId={playerId} sportId={sportId} />
      <MatchStatsSection playerId={playerId} sportId={sportId} />

      {selected && (
        <EvidenceBreakdownModal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          playerId={playerId}
          metric={selected}
          score={scoreByMetric.get(selected.id) ?? null}
          self={self}
          teamId={teamId}
          readOnly={readOnly}
          canEnterMatchStats={canEnterMatchStats}
        />
      )}

      {showAnalysis && (
        <EvidenceAnalysisModal isOpen={showAnalysis} onClose={() => setShowAnalysis(false)} playerId={playerId} />
      )}
    </div>
  );
}
