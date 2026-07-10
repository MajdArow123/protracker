import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend, LabelList,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { confidenceDotColor, confidenceLabel, isVerified } from '../evidence/evidenceUtils';
import type { EvidenceConfidence } from '../../types';

interface DataPoint {
  subject: string;
  value: number;
  previousValue?: number;
  /** Evidence confidence for this metric (drives dot color / dashed style). */
  confidence?: EvidenceConfidence;
}

interface Props {
  data: DataPoint[];
  height?: number;
  showPrevious?: boolean;
  /** Invoked with the point's subject when a confidence dot is clicked. */
  onPointClick?: (subject: string) => void;
}

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload?: DataPoint }[];
}) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-bold text-white">{Number(p.value).toFixed(1)} / 10</span>
        </div>
      ))}
      {point?.confidence && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-700">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ background: confidenceDotColor(point.confidence) }} />
            <span className="text-gray-300">
              {t('evidence.confidenceBadge', '{{level}} confidence', { level: confidenceLabel(point.confidence, t) })}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5">{t('evidence.clickToSeeEvidence', 'Click the point to see evidence')}</p>
        </div>
      )}
    </div>
  );
}

export function RadarChartWrapper({ data, height = 380, showPrevious, onPointClick }: Props) {
  const { t } = useTranslation();
  const hasPrev = showPrevious && data.some(d => d.previousValue !== undefined);
  const isMobile = useIsMobile();
  const h = isMobile ? Math.min(height, 280) : height;

  // Evidence styling: the current line renders solid only when every point with
  // confidence data is verified (High/VeryHigh); otherwise dashed = "estimated".
  const hasConfidence = data.some(d => d.confidence !== undefined);
  const allVerified = hasConfidence && data.every(d => d.confidence !== undefined && isVerified(d.confidence));
  const estimated = hasConfidence && !allVerified;

  return (
    <div>
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
            strokeDasharray={estimated ? '6 4' : undefined}
            dot={hasConfidence
              ? (props: { cx?: number; cy?: number; payload?: DataPoint }) => {
                  const { cx, cy, payload } = props;
                  const c = payload?.confidence;
                  return (
                    <circle
                      key={payload?.subject}
                      cx={cx}
                      cy={cy}
                      r={c && isVerified(c) ? 4 : 3.5}
                      fill={c ? confidenceDotColor(c) : '#6366f1'}
                      stroke="#fff"
                      strokeWidth={c && isVerified(c) ? 1 : 0}
                      style={{ cursor: onPointClick ? 'pointer' : undefined }}
                      onClick={() => payload && onPointClick?.(payload.subject)}
                    />
                  );
                }
              : { r: 3, fill: '#6366f1', strokeWidth: 0 }}
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
      {hasConfidence && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center -mt-1">
          {estimated
            ? t('evidence.radarLegendEstimated', 'Dashed = estimated · dots show evidence confidence')
            : t('evidence.radarLegendVerified', 'Solid = verified by evidence')}
        </p>
      )}
    </div>
  );
}
