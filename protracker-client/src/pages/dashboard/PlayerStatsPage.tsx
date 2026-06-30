import { useState } from 'react';
import { useMyPlayerId } from '../../hooks/useDashboard';
import { usePlayerAssessments } from '../../hooks/useAssessments';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChartWrapper } from '../../components/charts/LineChartWrapper';
import { TrendingUp, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
];

function scoreColor(s: number) {
  if (s >= 8) return 'text-green-500';
  if (s >= 6) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBg(s: number) {
  if (s >= 8) return 'bg-green-500/10 border-green-500/20';
  if (s >= 6) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function PlayerStatsPage() {
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: assessments, isLoading } = usePlayerAssessments(playerId);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

  if (loadingId || isLoading) return <PageSpinner />;

  // Sort oldest → newest for chart
  const sorted = assessments
    ? [...assessments].sort(
        (a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime()
      )
    : [];

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
          {/* Progress chart */}
          <Card header="Progress Over Time">
            {/* Stat filter pills */}
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
                      'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
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
                  className="px-3 py-1 rounded-full text-xs font-semibold border border-dashed border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500 transition-all"
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

          {/* Assessment history */}
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-400" />
              Assessment History
            </h2>
            <div className="space-y-4">
              {[...assessments]
                .sort((a, b) => new Date(b.dateRecorded).getTime() - new Date(a.dateRecorded).getTime())
                .map((a, idx) => {
                  const avg =
                    a.statScores?.length
                      ? a.statScores.reduce((sum, s) => sum + s.score, 0) / a.statScores.length
                      : null;
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {a.assessmentPeriodName ||
                              new Date(a.dateRecorded).toLocaleDateString('en-US', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                              })}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {new Date(a.dateRecorded).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                            {idx === 0 && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold">
                                Latest
                              </span>
                            )}
                          </p>
                        </div>
                        {avg !== null && (
                          <div className={clsx('px-3 py-1.5 rounded-xl border text-sm font-black', scoreBg(avg), scoreColor(avg))}>
                            {avg.toFixed(1)}<span className="text-xs font-normal opacity-60 ml-0.5">/10</span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {a.statScores?.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2"
                          >
                            <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{s.statCategoryName}</span>
                            <span className={clsx('text-sm font-bold ml-2 flex-shrink-0', scoreColor(s.score))}>
                              {s.score.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
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
