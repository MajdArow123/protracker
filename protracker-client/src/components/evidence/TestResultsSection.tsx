import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { FlaskConical, RefreshCw, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonChart } from '../ui/Skeleton';
import { scoreColor } from '../assessments/ScoreWidgets';
import { scoreTone, SCORE_TONE_HEX, CHART_GRID, AXIS_TICK } from '../charts/chartColors';
import { TooltipContent } from '../charts/TooltipContent';
import { MetricTrendSummary } from './MetricTrendSummary';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { usePlayerObjectiveTests, useSportMetrics } from '../../hooks/useEvidence';
import { usePlayerBenchmarks } from '../../hooks/useBenchmarks';
import type { ObjectiveTestResult, SportMetricDefinition } from '../../types';

interface Props {
  playerId: number;
  sportId: number | null | undefined;
}

// Lower-is-better tests (sprints) have their benchmark direction inverted.
function isLowerBetter(metric: SportMetricDefinition) {
  return metric.benchmarkHigh < metric.benchmarkLow;
}

function personalBest(tests: ObjectiveTestResult[], metric: SportMetricDefinition) {
  if (tests.length === 0) return null;
  return tests.reduce((best, t) =>
    (isLowerBetter(metric) ? t.value < best.value : t.value > best.value) ? t : best);
}

type ChartPoint = {
  date: string;
  value: number;
  score: number;
  isBest: boolean;
  testedBy: ObjectiveTestResult['testedBy'];
};

function RawChartTooltip({ active, payload, unit }: {
  active?: boolean;
  payload?: { value: number; payload: ChartPoint }[];
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-sm">
      <p className="text-gray-400 text-xs">{p.payload.date}</p>
      <p className="font-bold text-white">{p.value} {unit}</p>
      <p className="text-xs" style={{ color: scoreColor(p.payload.score) }}>{p.payload.score}/10</p>
    </div>
  );
}

// Objective test history for one metric: a direction-safe "Progress" view
// (normalizedScore 0-10 over time — the longitudinal payoff of the evidence
// system) with a raw-values deep dive behind a toggle, summary/trend strip,
// benchmark anchors, personal best, and a recent-results timeline.
export function TestResultsSection({ playerId, sportId }: Props) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocaleFormat();
  const { data: tests = [], isLoading: loadingTests, isError: testsError, refetch: refetchTests } = usePlayerObjectiveTests(playerId);
  const { data: metrics = [], isLoading: loadingMetrics } = useSportMetrics(sportId);
  const { data: benchmarks } = usePlayerBenchmarks(playerId);

  const metricById = useMemo(() => new Map(metrics.map(m => [m.id, m])), [metrics]);
  const testedMetricIds = useMemo(
    () => [...new Set(tests.map(x => x.metricDefinitionId))].filter(id => metricById.has(id)),
    [tests, metricById]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<'progress' | 'raw'>('progress');
  const activeId = selectedId ?? testedMetricIds[0] ?? null;
  const metric = activeId != null ? metricById.get(activeId) : undefined;

  const metricTests = useMemo(() => tests
    .filter(x => x.metricDefinitionId === activeId)
    .sort((a, b) => new Date(a.testedAt).getTime() - new Date(b.testedAt).getTime()),
    [tests, activeId]);

  const header = (
    <span className="flex items-center gap-2">
      <FlaskConical size={15} className="text-indigo-500" />
      {t('evidence.testResultsTitle', 'Test Results')}
    </span>
  );

  // FINDING-009 discipline: never render a resolved-looking empty state while
  // the query is in flight, and never a silent nothing on error.
  if (loadingTests || loadingMetrics) {
    return <Card header={header}><SkeletonChart height={200} /></Card>;
  }
  if (testsError) {
    return (
      <Card header={header}>
        <div className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('evidence.testsLoadError', "Couldn't load test results")}
          </span>
          <button
            type="button"
            onClick={() => refetchTests()}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} /> {t('common.retry', 'Retry')}
          </button>
        </div>
      </Card>
    );
  }
  if (tests.length === 0) {
    return (
      <Card header={header}>
        <EmptyState
          size="sm"
          icon={<FlaskConical size={22} />}
          title={t('evidence.noTestsTitle', 'No objective tests yet')}
          description={t('evidence.noTestsDesc', 'Record a test from the metric cards above to start tracking measured progress.')}
        />
      </Card>
    );
  }

  // Team benchmark calibration overrides the definition anchors for hints + chart lines.
  const calibrated = metric ? benchmarks?.values?.[metric.id] : undefined;
  const benchmarkMid = calibrated?.benchmarkMid ?? metric?.benchmarkMid ?? 0;
  const benchmarkHigh = calibrated?.benchmarkHigh ?? metric?.benchmarkHigh ?? 0;

  const best = metric ? personalBest(metricTests, metric) : null;
  const chartData: ChartPoint[] = metricTests.map(x => ({
    date: formatDate(x.testedAt, { month: 'short', day: 'numeric' }),
    value: x.value,
    score: x.normalizedScore,
    isBest: best != null && x.id === best.id,
    testedBy: x.testedBy,
  }));

  const unit = metric?.unit ?? '';
  // Benchmark anchors in normalized space are fixed by construction (Low→3,
  // Average→5, Elite→10). Deliberately NEUTRAL gray — these are benchmark
  // anchors, not the app's red/amber/green score bands.
  const anchorStyle = { stroke: '#9ca3af', strokeOpacity: 0.7, strokeDasharray: '4 4' } as const;
  const anchorLabel = (text: string, position: 'insideTopRight' | 'insideBottomRight') =>
    ({ value: text, fontSize: 9, fill: '#9ca3af', position });

  return (
    <Card header={header}>
      {/* Test type pills + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {testedMetricIds.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedId(id)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer',
                id === activeId
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
              )}
            >
              {metricById.get(id)?.name}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {([
            { key: 'progress', label: t('evidence.viewProgress', 'Score (0–10)') },
            { key: 'raw', label: t('evidence.viewRaw', 'Raw values') },
          ] as const).map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={clsx(
                'px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer',
                view === v.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {metric && (
        <>
          <MetricTrendSummary tests={metricTests} unit={unit} bestValue={best?.value ?? null} />

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {t('evidence.benchmarkCompare', 'Elite: {{high}} {{unit}} · Average: {{mid}} {{unit}}', {
                high: formatNumber(benchmarkHigh), mid: formatNumber(benchmarkMid),
                unit,
              })}
              {benchmarks?.profileName && (
                <span className="text-indigo-400"> · {benchmarks.profileName}</span>
              )}
            </span>
          </div>

          {view === 'progress' ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -24 }}>
                  <CartesianGrid {...CHART_GRID} vertical={false} />
                  <XAxis dataKey="date" tick={{ ...AXIS_TICK, fontSize: 10 }} />
                  <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ ...AXIS_TICK, fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as ChartPoint;
                      return (
                        <TooltipContent
                          title={p.date}
                          rows={[
                            { label: t('evidence.scoreLabel', 'Score'), value: `${p.score.toFixed(1)} / 10`, color: SCORE_TONE_HEX[scoreTone(p.score)] },
                            { label: t('evidence.resultLabel', 'Result'), value: `${formatNumber(p.value)} ${unit}`.trim() },
                            { label: t('evidence.testedByLabel', 'By'), value: t(`evidence.testedBy${p.testedBy}`, p.testedBy), muted: true },
                          ]}
                        />
                      );
                    }}
                  />
                  <ReferenceLine y={10} {...anchorStyle} label={anchorLabel(t('evidence.eliteLabel', 'Elite'), 'insideBottomRight')} />
                  <ReferenceLine y={5} {...anchorStyle} label={anchorLabel(t('evidence.averageLabel', 'Average'), 'insideTopRight')} />
                  <ReferenceLine y={3} {...anchorStyle} label={anchorLabel(t('evidence.lowLabel', 'Low'), 'insideTopRight')} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#6366f1"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={600}
                    dot={(props: { cx?: number; cy?: number; payload?: ChartPoint }) => {
                      const score = props.payload?.score ?? 0;
                      const isBest = props.payload?.isBest;
                      return (
                        <circle
                          key={`${props.cx}-${props.cy}`}
                          cx={props.cx} cy={props.cy}
                          r={isBest ? 5 : 3.5}
                          fill={SCORE_TONE_HEX[scoreTone(score)]}
                          stroke={isBest ? '#fff' : 'none'}
                          strokeWidth={isBest ? 1.5 : 0}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {chartData.length === 1
                  ? t('evidence.singleTestPoint', 'One test recorded — a second test starts the trend line.')
                  : t('evidence.benchmarkAnchorsHint', 'Dashed lines mark benchmark anchors (Low / Average / Elite), not score bands.')}
              </p>
            </>
          ) : chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  domain={['auto', 'auto']}
                  // Sprint-style charts read better with faster (lower) values up.
                  reversed={isLowerBetter(metric)}
                />
                <Tooltip content={<RawChartTooltip unit={unit} />} />
                <ReferenceLine y={benchmarkHigh} stroke="#10b981" strokeDasharray="4 4"
                  label={{ value: t('evidence.eliteLabel', 'Elite'), fontSize: 9, fill: '#10b981', position: 'insideTopRight' }} />
                <ReferenceLine y={benchmarkMid} stroke="#f59e0b" strokeDasharray="4 4"
                  label={{ value: t('evidence.averageLabel', 'Average'), fontSize: 9, fill: '#f59e0b', position: 'insideTopRight' }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={(props: { cx?: number; cy?: number; payload?: { isBest?: boolean } }) => (
                    <circle
                      key={`${props.cx}-${props.cy}`}
                      cx={props.cx} cy={props.cy}
                      r={props.payload?.isBest ? 5 : 3}
                      fill={props.payload?.isBest ? '#f59e0b' : '#6366f1'}
                      stroke={props.payload?.isBest ? '#fff' : 'none'}
                      strokeWidth={props.payload?.isBest ? 1.5 : 0}
                    />
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 py-3">
              {t('evidence.needTwoTests', 'Record a second {{metric}} test to see the progress trend.', { metric: metric.name })}
            </p>
          )}

          {/* Recent results timeline */}
          <div className="mt-3 space-y-1">
            {[...metricTests].reverse().slice(0, 5).map(x => (
              <div key={x.id} className="flex items-center gap-3 text-xs">
                <span className="text-gray-400 w-16 flex-shrink-0">{formatDate(x.testedAt, { month: 'short', day: 'numeric' })}</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium">{formatNumber(x.value)} {x.unit}</span>
                <span className="font-bold" style={{ color: scoreColor(x.normalizedScore) }}>{x.normalizedScore.toFixed(1)}/10</span>
                {best != null && x.id === best.id && <Trophy size={11} className="text-amber-500" />}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
