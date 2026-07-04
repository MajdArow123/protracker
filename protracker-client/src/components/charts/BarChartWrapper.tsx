import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from 'recharts';
import { useIsMobile } from '../../hooks/useMediaQuery';

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

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl min-w-[140px]">
      <p className="text-xs font-semibold text-gray-400 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}</span>
          </span>
          <span className="font-bold text-white">{Number(p.value).toFixed(1)} / 10</span>
        </div>
      ))}
    </div>
  );
}

function getBarGradientId(value: number): string {
  if (value < 5) return 'barGrad-red';
  if (value <= 7) return 'barGrad-amber';
  return 'barGrad-green';
}

export function BarChartWrapper({ data, series, height = 300, yAxisLabel, referenceLine, showValueLabels = false }: Props) {
  const useScoreColors = series.length === 1 && data.some(d => typeof d[series[0].key] === 'number');
  const leftMargin = yAxisLabel ? 20 : -10;
  const isMobile = useIsMobile();
  const h = isMobile ? Math.min(height, 250) : height;

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ top: showValueLabels ? 20 : 10, right: 16, left: leftMargin, bottom: 4 }}>
        <defs>
          {/* Gradient per color band */}
          {[
            { id: 'barGrad-red',    color: '#ef4444' },
            { id: 'barGrad-amber',  color: '#f59e0b' },
            { id: 'barGrad-green',  color: '#10b981' },
          ].map(g => (
            <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={g.color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={g.color} stopOpacity={0.55} />
            </linearGradient>
          ))}
          {/* Fallback gradient per series */}
          {series.map(s => (
            <linearGradient key={s.key} id={`barGrad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity={0.9} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={true} vertical={false} />

        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
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

        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

        {series.length > 1 && !isMobile && <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }} />}

        {referenceLine && (
          <ReferenceLine
            y={referenceLine.value}
            stroke="#6366f1"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: referenceLine.label,
              position: 'right',
              style: { fontSize: 10, fill: '#818cf8' },
            }}
          />
        )}

        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={useScoreColors ? undefined : `url(#barGrad-${s.key})`}
            radius={[5, 5, 0, 0]}
            maxBarSize={56}
            isAnimationActive
          >
            {useScoreColors &&
              data.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={`url(#${getBarGradientId(entry[s.key] as number)})`}
                />
              ))
            }
            {showValueLabels && (
              <LabelList
                dataKey={s.key}
                position="top"
                formatter={(v: unknown) => (typeof v === 'number' ? v.toFixed(1) : String(v ?? ''))}
                style={{ fontSize: 11, fontWeight: 700, fill: '#e5e7eb' }}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
