import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

interface DataPoint {
  subject: string;
  value: number;
  previousValue?: number;
}

interface Props {
  data: DataPoint[];
  height?: number;
  showPrevious?: boolean;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-bold text-white">{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function RadarChartWrapper({ data, height = 320, showPrevious }: Props) {
  const hasPrev = showPrevious && data.some(d => d.previousValue !== undefined);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <defs>
          <linearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="radarGradPrev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <PolarGrid stroke="#1f2937" strokeDasharray="3 3" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 10]}
          tick={{ fontSize: 9, fill: '#6b7280' }}
          tickCount={6}
        />
        <Tooltip content={<CustomTooltip />} />
        {hasPrev && <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />}
        {hasPrev && (
          <Radar
            name="Previous"
            dataKey="previousValue"
            stroke="#8b5cf6"
            fill="url(#radarGradPrev)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        )}
        <Radar
          name="Current"
          dataKey="value"
          stroke="#6366f1"
          fill="url(#radarGrad)"
          strokeWidth={2}
          dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
