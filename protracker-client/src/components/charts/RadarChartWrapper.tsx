import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
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

export function RadarChartWrapper({ data, height = 300, showPrevious }: Props) {
  const hasPrev = showPrevious && data.some(d => d.previousValue !== undefined);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data}>
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f9fafb' }}
          itemStyle={{ color: '#d1d5db' }}
        />
        {hasPrev && <Legend />}
        <Radar
          name="Current"
          dataKey="value"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.35}
          strokeWidth={2}
        />
        {hasPrev && (
          <Radar
            name="Previous"
            dataKey="previousValue"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.15}
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}
