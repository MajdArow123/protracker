import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from 'recharts';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { CHART_GRID, AXIS_TICK, SCORE_BANDS, scoreBand } from './chartColors';
import { TooltipContent } from './TooltipContent';

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
  yAxisLabel?: string;
  referenceLine?: { value: number; label: string };
  showValueLabels?: boolean;
}

export function BarChartWrapper({ data, series, height = 300, yAxisLabel, referenceLine, showValueLabels = false }: Props) {
  // Single 0-10 series → score-band coloring (red < 5 ≤ amber < 7 ≤ blue < 8.5 ≤ green).
  const useScoreColors = series.length === 1 && data.some(d => typeof d[series[0].key] === 'number');
  const leftMargin = yAxisLabel ? 20 : -10;
  const isMobile = useIsMobile();
  const h = isMobile ? Math.min(height, 250) : height;

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: showValueLabels ? 22 : 10, right: 16, left: leftMargin, bottom: 4 }}>
        <defs>
          {/* Score-band gradients: darker at the bottom, lighter at the top. */}
          {SCORE_BANDS.map(band => (
            <linearGradient key={band.id} id={band.id} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%"   stopColor={band.from} stopOpacity={0.95} />
              <stop offset="100%" stopColor={band.to} stopOpacity={0.9} />
            </linearGradient>
          ))}
          {/* Fallback gradient per series (multi-series charts). */}
          {series.map(s => (
            <linearGradient key={s.key} id={`barGrad-${s.key}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%"   stopColor={s.color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.6} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid {...CHART_GRID} horizontal vertical={false} />

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
            offset: -8,
            style: { fontSize: 10, fill: '#6b7280', textAnchor: 'middle' },
          } : undefined}
        />

        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,0.08)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <TooltipContent
                title={String(label)}
                rows={payload.map(p => ({
                  label: String(p.name),
                  value: `${Number(p.value).toFixed(1)} / 10`,
                  color: useScoreColors ? scoreBand(Number(p.value)).solid : (p.color as string),
                }))}
              />
            );
          }}
        />

        {series.length > 1 && !isMobile && <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }} />}

        {referenceLine && (
          <ReferenceLine
            y={referenceLine.value}
            stroke="#9ca3af"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            strokeOpacity={0.8}
            label={{
              value: referenceLine.label,
              position: 'right',
              style: { fontSize: 10, fontWeight: 600, fill: '#9ca3af' },
            }}
          />
        )}

        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={useScoreColors ? undefined : `url(#barGrad-${s.key})`}
            radius={[6, 6, 0, 0]}
            maxBarSize={56}
            isAnimationActive
            animationDuration={600}
          >
            {useScoreColors &&
              data.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={`url(#${scoreBand(entry[s.key] as number).id})`}
                />
              ))
            }
            {showValueLabels && (
              <LabelList
                dataKey={s.key}
                position="top"
                content={(props) => {
                  const { x, y, width, value } = props as { x?: number; y?: number; width?: number; value?: number };
                  if (typeof value !== 'number' || x == null || y == null || width == null) return null;
                  const color = useScoreColors ? scoreBand(value).solid : '#e5e7eb';
                  return (
                    <text
                      x={x + width / 2} y={y - 6}
                      textAnchor="middle"
                      style={{ fontSize: 11, fontWeight: 700, fill: color }}
                    >
                      {value.toFixed(1)}
                    </text>
                  );
                }}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
