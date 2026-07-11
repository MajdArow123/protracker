import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import {
  useSportMetrics, usePlayerObjectiveTests, usePlayerCoachEvaluations,
  usePlayerSelfAssessments, usePlayerMatchStats,
} from '../../hooks/useEvidence';
import { buildConfidenceTimeline } from './chartUtils';
import { CHART_GRID, AXIS_TICK, CONFIDENCE_COLORS } from './chartColors';
import { TooltipContent } from './TooltipContent';

interface Props {
  playerId: number;
  sportId: number | null | undefined;
  height?: number;
  /** 'card' renders its own bordered card shell; 'section' adds a divider above. */
  variant?: 'plain' | 'card' | 'section';
}

// How trustworthy the data has become over time: average confidence level (Low=1 …
// VeryHigh=4) across evidenced metrics, re-derived at every evidence-entry date.
// Rises as tests/stats accumulate, dips when tests expire.
export function ConfidenceChart({ playerId, sportId, height = 180, variant = 'plain' }: Props) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const isMobile = useIsMobile();

  const { data: metrics = [] } = useSportMetrics(sportId);
  const { data: tests = [] } = usePlayerObjectiveTests(playerId);
  const { data: coachEvals = [] } = usePlayerCoachEvaluations(playerId);
  const { data: selfAssessments = [] } = usePlayerSelfAssessments(playerId);
  const { data: matchStats = [] } = usePlayerMatchStats(playerId);

  const data = useMemo(() =>
    buildConfidenceTimeline(metrics, tests, coachEvals, selfAssessments, matchStats)
      .map(p => ({ ...p, name: formatDate(new Date(p.date).toISOString(), { month: 'short', day: 'numeric' }) })),
    [metrics, tests, coachEvals, selfAssessments, matchStats, formatDate]);

  if (data.length < 2) return null;

  const latest = data[data.length - 1].level;
  const lineColor = latest >= 3 ? CONFIDENCE_COLORS.High
    : latest >= 2 ? CONFIDENCE_COLORS.Medium
    : CONFIDENCE_COLORS.Low;

  const levelName = (v: number) =>
    v >= 3.5 ? t('evidence.confidenceVeryHigh', 'Very High')
    : v >= 2.5 ? t('evidence.confidenceHigh', 'High')
    : v >= 1.5 ? t('evidence.confidenceMedium', 'Medium')
    : t('evidence.confidenceLow', 'Low');

  const shell = variant === 'card'
    ? 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4'
    : variant === 'section'
      ? 'mt-5 pt-4 border-t border-gray-100 dark:border-gray-800'
      : undefined;

  return (
    <div className={shell}>
      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {t('evidence.confidenceOverTime', 'Confidence Over Time')}
      </h4>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
        {t('evidence.confidenceOverTimeHint', 'Average data confidence across metrics as evidence accumulates')}
      </p>
      <ResponsiveContainer width="100%" height={isMobile ? Math.min(height, 150) : height}>
        <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...CHART_GRID} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, 4]}
            ticks={[1, 2, 3, 4]}
            tick={{ ...AXIS_TICK, fontSize: 9 }}
            tickFormatter={v => levelName(Number(v))}
            width={58}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: '#6b7280', strokeOpacity: 0.3, strokeDasharray: '3 3' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const v = Number(payload[0].value);
              return (
                <TooltipContent
                  title={String(label)}
                  rows={[{ label: t('evidence.confidence', 'Confidence'), value: levelName(v), color: lineColor }]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="level"
            stroke={lineColor}
            strokeWidth={2.5}
            fill="url(#confGrad)"
            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: lineColor, stroke: '#fff', strokeWidth: 1.5 }}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
