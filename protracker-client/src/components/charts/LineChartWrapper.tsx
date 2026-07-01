import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
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
  focusedKey?: string | null;
  yAxisLabel?: string;
}

function CustomTooltip({
  active, payload, label, focusedKey,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string }[];
  label?: string;
  focusedKey?: string | null;
}) {
  if (!active || !payload?.length) return null;

  // Sort: focused first, then by value desc
  const sorted = [...payload].sort((a, b) => {
    if (focusedKey) {
      if (a.dataKey === focusedKey) return -1;
      if (b.dataKey === focusedKey) return 1;
    }
    return b.value - a.value;
  });

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl min-w-[160px]">
      <p className="text-xs font-semibold text-gray-400 mb-2.5 pb-2 border-b border-slate-800">{label}</p>
      <div className="space-y-1.5">
        {sorted.map((p) => {
          const isFocused = focusedKey ? p.dataKey === focusedKey : false;
          return (
            <div
              key={p.dataKey}
              className={`flex items-center justify-between gap-4 text-sm ${
                focusedKey && !isFocused ? 'opacity-40' : ''
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className={isFocused ? 'text-white font-medium' : 'text-gray-300'}>{p.name}</span>
              </span>
              <span className={`font-bold tabular-nums ${isFocused ? 'text-white' : 'text-gray-400'}`}>
                {Number(p.value).toFixed(1)} / 10
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LineChartWrapper({ data, series, height = 300, focusedKey = null, yAxisLabel }: Props) {
  const fewPoints = data.length <= 4;
  const leftMargin = yAxisLabel ? 16 : -10;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 24, left: leftMargin, bottom: 4 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`lg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={s.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />

        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 8, 10]}
          axisLine={false}
          tickLine={false}
          label={yAxisLabel ? {
            value: yAxisLabel,
            angle: -90,
            position: 'insideLeft',
            offset: -4,
            style: { fontSize: 10, fill: '#4b5563', textAnchor: 'middle' },
          } : undefined}
        />

        <Tooltip
          content={(props) => (
            <CustomTooltip
              active={props.active}
              payload={props.payload as unknown as { name: string; value: number; color: string; dataKey: string }[]}
              label={props.label as string}
              focusedKey={focusedKey}
            />
          )}
          cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '3 3' }}
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
            />
          );
        })}

        {series.map((s) => {
          const isFocused = focusedKey === s.key;
          const hasFocus = focusedKey !== null;

          // When something is focused: focused=thick+opaque, others=thin+faint
          const strokeWidth = hasFocus ? (isFocused ? 3 : 1) : 2;
          const opacity     = hasFocus ? (isFocused ? 1 : 0.15) : 0.85;
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
              dot={showDots ? { r: isFocused ? 4 : 2.5, fill: s.color, stroke: '#111827', strokeWidth: 1.5 } : false}
              activeDot={isFocused || !hasFocus ? { r: 5, fill: s.color, stroke: '#111827', strokeWidth: 2 } : false}
              connectNulls
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
