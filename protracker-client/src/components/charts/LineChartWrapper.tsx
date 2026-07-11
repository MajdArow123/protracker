import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from 'recharts';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { CHART_GRID, AXIS_TICK } from './chartColors';
import { TooltipContent, type TooltipRow } from './TooltipContent';
import type { EvidenceConfidence } from '../../types';

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface Series {
  key: string;
  name: string;
  color: string;
}

interface Props {
  data: DataPoint[];
  series: Series[];
  height?: number;
  focusedKey?: string | null;
  yAxisLabel?: string;
  /** Per-series confidence: Low/Medium render dashed ("estimated"), High+ solid. */
  confidenceByKey?: Record<string, EvidenceConfidence>;
}

const isVerified = (c?: EvidenceConfidence) => c === 'High' || c === 'VeryHigh';

export function LineChartWrapper({ data, series, height = 300, focusedKey = null, yAxisLabel, confidenceByKey }: Props) {
  const fewPoints = data.length <= 4;
  const leftMargin = yAxisLabel ? 16 : -10;
  const isMobile = useIsMobile();
  const h = isMobile ? Math.min(height, 250) : height;
  const hasConfidence = !!confidenceByKey && Object.keys(confidenceByKey).length > 0;

  return (
    <ResponsiveContainer width="100%" height={h}>
      <ComposedChart data={data} margin={{ top: 12, right: 24, left: leftMargin, bottom: 4 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`lg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={s.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid {...CHART_GRID} vertical={false} />

        <XAxis
          dataKey="name"
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={AXIS_TICK}
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 8, 10]}
          axisLine={false}
          tickLine={false}
          label={yAxisLabel ? {
            value: yAxisLabel,
            angle: -90,
            position: 'insideLeft',
            offset: -4,
            style: { fontSize: 10, fill: '#6b7280', textAnchor: 'middle' },
          } : undefined}
        />

        <Tooltip
          cursor={{ stroke: '#6b7280', strokeOpacity: 0.35, strokeWidth: 1, strokeDasharray: '3 3' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const rows: TooltipRow[] = [...payload]
              .filter(p => typeof p.value === 'number')
              .sort((a, b) => {
                if (focusedKey) {
                  if (a.dataKey === focusedKey) return -1;
                  if (b.dataKey === focusedKey) return 1;
                }
                return Number(b.value) - Number(a.value);
              })
              .map(p => ({
                label: String(p.name),
                value: `${Number(p.value).toFixed(1)} / 10`,
                color: p.color as string,
                muted: !!focusedKey && p.dataKey !== focusedKey,
                confidence: confidenceByKey?.[String(p.dataKey)],
              }));
            return <TooltipContent title={String(label)} rows={rows} />;
          }}
        />

        {series.map((s) => {
          const isFocused = focusedKey === s.key;
          // With multiple series, only fill under the focused line — stacking a
          // semi-transparent fill under every series at once looks muddy. A lone
          // series always gets its fill since there's nothing to overlap with.
          if (series.length > 1 && !isFocused) return null;
          return (
            <Area
              key={`area-${s.key}`}
              type="monotone"
              dataKey={s.key}
              stroke="none"
              fill={`url(#lg-${s.key})`}
              fillOpacity={1}
              connectNulls
              isAnimationActive
              animationDuration={800}
            />
          );
        })}

        {series.map((s) => {
          const isFocused = focusedKey === s.key;
          const hasFocus = focusedKey !== null;
          const confidence = confidenceByKey?.[s.key];
          const dashed = hasConfidence && confidence !== undefined && !isVerified(confidence);

          // When something is focused: focused=thick+opaque, others=thin+faint.
          const strokeWidth = hasFocus ? (isFocused ? 3 : 1.25) : 2.5;
          const opacity     = hasFocus ? (isFocused ? 1 : 0.15) : 0.9;
          const showDots    = fewPoints || isFocused;

          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={hasFocus && !isFocused ? '#6b7280' : s.color}
              strokeWidth={strokeWidth}
              strokeOpacity={opacity}
              strokeDasharray={dashed ? '6 4' : undefined}
              dot={showDots ? { r: 4, fill: s.color, stroke: '#111827', strokeWidth: 1.5 } : false}
              activeDot={isFocused || !hasFocus
                ? { r: 7, fill: s.color, stroke: '#fff', strokeWidth: 2 }
                : false}
              connectNulls
              isAnimationActive
              animationDuration={800}
            />
          );
        })}

        {/* End-of-line label for the focused series */}
        {focusedKey && data.length > 0 && (() => {
          const lastPoint = data[data.length - 1];
          const s = series.find(s => s.key === focusedKey);
          const val = lastPoint?.[focusedKey];
          if (!s || val === undefined) return null;
          return (
            <ReferenceDot
              x={lastPoint.name}
              y={val as number}
              r={0}
              label={{
                value: `${s.name} ${Number(val).toFixed(1)}`,
                position: 'right',
                style: { fontSize: 10, fontWeight: 700, fill: s.color },
              }}
            />
          );
        })()}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
