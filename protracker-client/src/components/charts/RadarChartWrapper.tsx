import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend, LabelList,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';

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
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-bold text-white">{Number(p.value).toFixed(1)} / 10</span>
        </div>
      ))}
    </div>
  );
}

export function RadarChartWrapper({ data, height = 380, showPrevious }: Props) {
  const { t } = useTranslation();
  const hasPrev = showPrevious && data.some(d => d.previousValue !== undefined);
  const isMobile = useIsMobile();
  const h = isMobile ? Math.min(height, 280) : height;

  return (
    <ResponsiveContainer width="100%" height={h}>
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
            name={t('reports.previous', 'Previous')}
            dataKey="previousValue"
            stroke="#8b5cf6"
            fill="url(#radarGradPrev)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        )}
        <Radar
          name={t('reports.current', 'Current')}
          dataKey="value"
          stroke="#6366f1"
          fill="url(#radarGrad)"
          strokeWidth={2}
          dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
          isAnimationActive
        >
          <LabelList
            dataKey="value"
            position="outside"
            formatter={(v: unknown) => (typeof v === 'number' ? v.toFixed(1) : String(v ?? ''))}
            style={{ fontSize: 10, fontWeight: 700, fill: '#818cf8' }}
          />
        </Radar>
      </RadarChart>
    </ResponsiveContainer>
  );
}
