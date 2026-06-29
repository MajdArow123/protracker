import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';

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
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl min-w-[120px]">
      <p className="text-xs font-semibold text-gray-400 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}</span>
          </span>
          <span className="font-bold text-white">{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function getBarColor(value: number, baseColor: string): string {
  if (typeof value !== 'number') return baseColor;
  if (value < 5) return '#ef4444';
  if (value < 7) return '#f59e0b';
  return '#10b981';
}

export function BarChartWrapper({ data, series, height = 300 }: Props) {
  const useScoreColors = series.length === 1 && data.some(d => typeof d[series[0].key] === 'number');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`barGrad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.9} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.6} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={true} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 10]} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={useScoreColors ? undefined : `url(#barGrad-${s.key})`}
            radius={[6, 6, 0, 0]}
            maxBarSize={60}
          >
            {useScoreColors &&
              data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(entry[s.key] as number, s.color)}
                />
              ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
