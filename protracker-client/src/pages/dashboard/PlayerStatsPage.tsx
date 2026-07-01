import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMyPlayerId } from '../../hooks/useDashboard';
import { usePlayerAssessments } from '../../hooks/useAssessments';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChartWrapper } from '../../components/charts/LineChartWrapper';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
];

function scoreColor(s: number): string {
  if (s > 7) return '#10b981';
  if (s >= 5) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(s: number): { text: string; cls: string } {
  if (s > 7) return { text: 'Good', cls: 'text-green-500 bg-green-500/10' };
  if (s >= 5) return { text: 'Fair', cls: 'text-amber-500 bg-amber-500/10' };
  return { text: 'Low', cls: 'text-red-500 bg-red-500/10' };
}

function pct(from: number, to: number) {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}

export function PlayerStatsPage() {
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: assessments, isLoading } = usePlayerAssessments(playerId);
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

  if (loadingId || isLoading) return <PageSpinner />;

  const chartData: Array<{ name: string; [key: string]: string | number }> =
    sorted.map((a) => {
      const point: { name: string; [key: string]: string | number } = {
        name: a.assessmentPeriodName || new Date(a.dateRecorded).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
    <PageWrapper title="My Stats">
      {!assessments?.length ? (
        <EmptyState
          icon={<TrendingUp size={32} />}
          title="No stats yet"
          description="Your coach will add assessments here"
        />
      ) : (
        <div className="space-y-6">
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Assessments</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{assessments.length}</p>
            </div>
            {sorted.length > 0 && (() => {
              const latestAvg = sorted[sorted.length - 1].statScores.reduce((s, x) => s + x.score, 0) / (sorted[sorted.length - 1].statScores.length || 1);
              const color = scoreColor(latestAvg);
              const label = scoreLabel(latestAvg);
              return (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Latest Score</p>
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-black" style={{ color }}>{latestAvg.toFixed(1)}</p>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold mb-0.5', label.cls)}>{label.text}</span>
                  </div>
                </div>
              );
            })()}
            {overallChange !== null && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Overall Change</p>
                <p className={clsx('text-2xl font-black', overallChange >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {overallChange > 0 ? '+' : ''}{overallChange.toFixed(0)}%
                </p>
              </div>
            )}
          </div>

          {/* Progress chart */}
          <Card header="Progress Over Time">
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
                  Show all
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
              yAxisLabel="Score / 10"
            />
          </Card>

          {/* Assessment timeline */}
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-400" />
              Assessment History
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

                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0">
                            <div className={clsx(
                              'w-3 h-3 rounded-full border-2',
                              idx === 0
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
                            )} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-900 dark:text-white text-sm">{a.assessmentPeriodName}</p>
                              {idx === 0 && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">Latest</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(a.dateRecorded).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {avgCurr !== null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-black" style={{ color }}>{avgCurr.toFixed(1)}</span>
                              {label && <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', label.cls)}>{label.text}</span>}
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
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        </div>
                      </div>

                      {/* Score pills */}
                      {a.statScores?.length > 0 && (
                        <div className="px-4 pb-3">
                          <div className="flex flex-wrap gap-1.5">
                            {a.statScores.map(s => (
                              <div key={s.id} className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{s.statCategoryName}</span>
                                <span
                                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ color: scoreColor(s.score), background: `${scoreColor(s.score)}20` }}
                                >
                                  {s.score}
                                </span>
                              </div>
                            ))}
                          </div>
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
                            <div className="p-4">
                              {a.statScores?.length > 0 && (
                                <RadarChartWrapper
                                  data={a.statScores.map(s => ({
                                    subject: s.statCategoryName,
                                    value: s.score,
                                    previousValue: prev?.statScores?.find(ps => ps.sportStatCategoryId === s.sportStatCategoryId)?.score,
                                  }))}
                                  height={220}
                                  showPrevious={!!prev}
                                />
                              )}
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
    </PageWrapper>
  );
}
