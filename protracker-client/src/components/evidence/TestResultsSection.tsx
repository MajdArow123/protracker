import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { FlaskConical, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../ui/Card';
import { scoreColor } from '../assessments/ScoreWidgets';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { usePlayerObjectiveTests, useSportMetrics } from '../../hooks/useEvidence';
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

function ChartTooltip({ active, payload, unit }: {
  active?: boolean;
  payload?: { value: number; payload: { date: string; score: number } }[];
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

// Objective test history: progress chart per test type with benchmark reference lines,
// personal best, and a recent-results timeline.
export function TestResultsSection({ playerId, sportId }: Props) {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useLocaleFormat();
  const { data: tests = [] } = usePlayerObjectiveTests(playerId);
  const { data: metrics = [] } = useSportMetrics(sportId);

  const metricById = useMemo(() => new Map(metrics.map(m => [m.id, m])), [metrics]);
  const testedMetricIds = useMemo(
    () => [...new Set(tests.map(x => x.metricDefinitionId))].filter(id => metricById.has(id)),
    [tests, metricById]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const activeId = selectedId ?? testedMetricIds[0] ?? null;
  const metric = activeId != null ? metricById.get(activeId) : undefined;

  const metricTests = useMemo(() => tests
    .filter(x => x.metricDefinitionId === activeId)
    .sort((a, b) => new Date(a.testedAt).getTime() - new Date(b.testedAt).getTime()),
    [tests, activeId]);

  if (tests.length === 0) return null;

  const best = metric ? personalBest(metricTests, metric) : null;
  const chartData = metricTests.map(x => ({
    date: formatDate(x.testedAt, { month: 'short', day: 'numeric' }),
    value: x.value,
    score: x.normalizedScore,
    isBest: best != null && x.id === best.id,
  }));

  return (
    <Card header={
      <span className="flex items-center gap-2">
        <FlaskConical size={15} className="text-indigo-500" />
        {t('evidence.testResultsTitle', 'Test Results')}
      </span>
    }>
      {/* Test type pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
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

      {metric && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
            {best && (
              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <Trophy size={12} />
                {t('evidence.personalBest', 'Personal best: {{value}} {{unit}}', {
                  value: formatNumber(best.value), unit: best.unit,
                })}
              </span>
            )}
            <span>
              {t('evidence.benchmarkCompare', 'Elite: {{high}} {{unit}} · Average: {{mid}} {{unit}}', {
                high: formatNumber(metric.benchmarkHigh), mid: formatNumber(metric.benchmarkMid),
                unit: metric.unit ?? '',
              })}
            </span>
          </div>

          {chartData.length >= 2 ? (
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
                <Tooltip content={<ChartTooltip unit={metric.unit ?? ''} />} />
                <ReferenceLine y={metric.benchmarkHigh} stroke="#10b981" strokeDasharray="4 4"
                  label={{ value: t('evidence.eliteLabel', 'Elite'), fontSize: 9, fill: '#10b981', position: 'insideTopRight' }} />
                <ReferenceLine y={metric.benchmarkMid} stroke="#f59e0b" strokeDasharray="4 4"
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
