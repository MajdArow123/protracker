import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMyPlayerId } from '../../hooks/useDashboard';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { usePlayerAssessments } from '../../hooks/useAssessments';
import { usePlayer } from '../../hooks/usePlayers';
import { EvidenceDashboardTab } from '../../components/evidence/EvidenceDashboardTab';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChartWrapper } from '../../components/charts/LineChartWrapper';
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3, Trophy, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
];

function scoreColor(s: number): string {
  if (s > 7) return '#10b981';
  if (s >= 5) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(s: number): { text: string; cls: string; key: string } {
  if (s > 7) return { text: 'Good', cls: 'text-green-500 bg-green-500/10', key: 'dashboard.scoreGood' };
  if (s >= 5) return { text: 'Fair', cls: 'text-amber-500 bg-amber-500/10', key: 'dashboard.scoreFair' };
  return { text: 'Low', cls: 'text-red-500 bg-red-500/10', key: 'dashboard.scoreLow' };
}

function pct(from: number, to: number) {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}

export function PlayerStatsPage() {
  const { t } = useTranslation();
  const fmt = useLocaleFormat();
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: assessments, isLoading } = usePlayerAssessments(playerId);
  const { data: player } = usePlayer(playerId ?? 0);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Sort oldest → newest for chart and trend calculations
  const sorted = useMemo(() =>
    assessments
      ? [...assessments].sort(
          (a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime()
        )
      : [],
    [assessments]
  );

  // Best / weakest category from the most recent assessment
  const summary = useMemo(() => {
    if (sorted.length === 0) return null;
    const latest = sorted[sorted.length - 1];
    const scores = latest.statScores ?? [];
    const bestScore = scores.length > 0 ? scores.reduce((a, b) => (b.score > a.score ? b : a)) : null;
    const worstScore = scores.length > 0 ? scores.reduce((a, b) => (b.score < a.score ? b : a)) : null;
    const best = bestScore ? { name: bestScore.statCategoryName, score: bestScore.score } : null;
    const worst = worstScore ? { name: worstScore.statCategoryName, score: worstScore.score } : null;
    return { best, worst };
  }, [sorted]);

  if (loadingId || isLoading) return <PageSpinner />;

  const chartData: Array<{ name: string; [key: string]: string | number }> =
    sorted.map((a) => {
      const point: { name: string; [key: string]: string | number } = {
        name: a.assessmentPeriodName || fmt.formatDate(a.dateRecorded, { month: 'short', day: 'numeric' }),
      };
      a.statScores?.forEach((s) => {
        point[s.statCategoryName] = s.score;
      });
      return point;
    });

  const allCategories = [
    ...new Set(
      sorted.flatMap((a) => a.statScores?.map((s) => s.statCategoryName) ?? [])
    ),
  ];

  // Overall improvement (first vs last)
  let overallChange: number | null = null;
  if (sorted.length >= 2) {
    const firstAvg = sorted[0].statScores.reduce((s, x) => s + x.score, 0) / (sorted[0].statScores.length || 1);
    const lastAvg = sorted[sorted.length - 1].statScores.reduce((s, x) => s + x.score, 0) / (sorted[sorted.length - 1].statScores.length || 1);
    overallChange = pct(firstAvg, lastAvg);
  }

  return (
    <PageWrapper title={t('nav.myStats', 'My Stats')}>
      {!assessments?.length ? (
        <EmptyState
          icon={<TrendingUp size={32} />}
          title={t('dashboard.noStatsYet', 'No stats yet')}
          description={t('dashboard.noStatsDesc', 'Your coach will add assessments here')}
        />
      ) : (
        <div className="space-y-6">
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={13} className="text-indigo-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('nav.assessments', 'Assessments')}</p>
              </div>
              <p className="text-xl font-black text-gray-900 dark:text-white">{assessments.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={13} className="text-indigo-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('dashboard.improvement', 'Improvement')}</p>
              </div>
              {overallChange !== null ? (
                <p className={clsx('text-xl font-black', overallChange >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {overallChange > 0 ? '+' : ''}{overallChange.toFixed(0)}%
                </p>
              ) : <p className="text-xl font-black text-gray-400">—</p>}
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={13} className="text-green-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('dashboard.best', 'Best')}</p>
              </div>
              {summary?.best ? (
                <>
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{summary.best.name}</p>
                  <p className="text-xs text-green-500 font-semibold">{summary.best.score}/10</p>
                </>
              ) : <p className="text-xl font-black text-gray-400">—</p>}
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={13} className="text-amber-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('dashboard.weakest', 'Weakest')}</p>
              </div>
              {summary?.worst ? (
                <>
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{summary.worst.name}</p>
                  <p className="text-xs text-amber-500 font-semibold">{summary.worst.score}/10</p>
                </>
              ) : <p className="text-xl font-black text-gray-400">—</p>}
            </div>
          </div>

          {/* Progress chart */}
          <Card header={t('dashboard.progressOverTime', 'Progress Over Time')}>
            <div className="flex flex-wrap gap-2 mb-5">
              {allCategories.map((cat, i) => {
                const color = CHART_COLORS[i % CHART_COLORS.length];
                const isFocused = focusedCategory === cat;
                const hasFocus = focusedCategory !== null;
                return (
                  <button
                    key={cat}
                    onClick={() => setFocusedCategory((prev) => (prev === cat ? null : cat))}
                    className={clsx(
                      'px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                      isFocused
                        ? 'text-white border-transparent'
                        : hasFocus
                        ? 'text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 opacity-50'
                        : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    )}
                    style={isFocused ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                      style={{ background: isFocused ? 'white' : color }}
                    />
                    {cat}
                  </button>
                );
              })}
              {focusedCategory && (
                <button
                  onClick={() => setFocusedCategory(null)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border border-dashed border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500 transition-all cursor-pointer"
                >
                  {t('dashboard.showAll', 'Show all')}
                </button>
              )}
            </div>

            <LineChartWrapper
              data={chartData}
              series={allCategories.map((cat, i) => ({
                key: cat,
                name: cat,
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
              height={280}
              focusedKey={focusedCategory}
              yAxisLabel={t('dashboard.scoreOutOf10', 'Score / 10')}
            />
          </Card>

          {/* Assessment timeline */}
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-400" />
              {t('dashboard.assessmentHistory', 'Assessment History')}
            </h2>
            <div className="space-y-3">
              {[...assessments]
                .sort((a, b) => new Date(b.dateRecorded).getTime() - new Date(a.dateRecorded).getTime())
                .map((a, idx) => {
                  const sortedIdx = sorted.findIndex(s => s.id === a.id);
                  const prev = sortedIdx > 0 ? sorted[sortedIdx - 1] : null;
                  const avgCurr = a.statScores?.length
                    ? a.statScores.reduce((s, x) => s + x.score, 0) / a.statScores.length
                    : null;
                  const avgPrev = prev?.statScores?.length
                    ? prev.statScores.reduce((s, x) => s + x.score, 0) / prev.statScores.length
                    : null;
                  const trend = avgCurr !== null && avgPrev !== null ? pct(avgPrev, avgCurr) : null;
                  const isExpanded = expandedId === a.id;
                  const color = avgCurr !== null ? scoreColor(avgCurr) : '#6b7280';
                  const label = avgCurr !== null ? scoreLabel(avgCurr) : null;
                  const borderColor = !prev ? '#9ca3af' : trend !== null && trend > 0 ? '#10b981' : trend !== null && trend < 0 ? '#ef4444' : '#9ca3af';

                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden border-l-4"
                      style={{ borderLeftColor: borderColor }}
                    >
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{a.assessmentPeriodName}</p>
                            {idx === 0 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">{t('dashboard.latest', 'Latest')}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {fmt.formatDate(a.dateRecorded, { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {avgCurr !== null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-black" style={{ color }}>{avgCurr.toFixed(1)}</span>
                              {label && <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', label.cls)}>{t(label.key, label.text)}</span>}
                            </div>
                          )}
                          {trend !== null && (
                            <span className={clsx(
                              'flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
                              trend > 0 ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : trend < 0 ? 'text-red-600 bg-red-100 dark:bg-red-900/30' : 'text-gray-500 bg-gray-100 dark:bg-gray-800'
                            )}>
                              {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                              {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
                            </span>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : a.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                          >
                            {isExpanded ? t('common.collapse', 'Collapse') : t('common.expand', 'Expand')}
                          </button>
                        </div>
                      </div>

                      {/* Mini horizontal score bars */}
                      {a.statScores?.length > 0 && (
                        <div className="px-4 pb-4 space-y-1.5">
                          {a.statScores.map(s => (
                            <div key={s.id} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-24 flex-shrink-0 truncate">{s.statCategoryName}</span>
                              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${(s.score / 10) * 100}%`, background: scoreColor(s.score) }}
                                />
                              </div>
                              <span className="text-xs font-bold w-7 text-right flex-shrink-0" style={{ color: scoreColor(s.score) }}>
                                {s.score}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
                          >
                            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {a.statScores.map(s => (
                                <div
                                  key={s.id}
                                  className="rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                                  style={{ background: `${scoreColor(s.score)}18`, border: `1px solid ${scoreColor(s.score)}40` }}
                                >
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{s.statCategoryName}</span>
                                  <span className="text-sm font-black flex-shrink-0" style={{ color: scoreColor(s.score) }}>{s.score}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Evidence: the athlete's own metric confidence picture. Team athletes can add
          tests and guided self-evaluations; match stats stay coach-entered. */}
      {playerId && player?.sportId && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
            {t('evidence.myEvidenceTitle', 'My Evidence')}
          </h3>
          <EvidenceDashboardTab
            playerId={playerId}
            sportId={player.sportId}
            self
            teamId={player.teamId}
            canEnterMatchStats={false}
          />
        </div>
      )}
    </PageWrapper>
  );
}
