import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { CONFIDENCE_COLORS } from './chartColors';
import { TooltipContent } from './TooltipContent';
import { confidenceLabel, isVerified } from '../evidence/evidenceUtils';
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

export function RadarChartWrapper({ data, height = 420, showPrevious, onPointClick }: Props) {
  const { t } = useTranslation();
  const hasPrev = showPrevious && data.some(d => d.previousValue !== undefined);
  const isMobile = useIsMobile();
  const h = isMobile ? Math.min(height, 300) : Math.max(height, 400);

  // Evidence styling: the current line renders solid only when every point with
  // confidence data is verified (High/VeryHigh); otherwise dashed = "estimated".
  const hasConfidence = data.some(d => d.confidence !== undefined);
  const allVerified = hasConfidence && data.every(d => d.confidence !== undefined && isVerified(d.confidence));
  const estimated = hasConfidence && !allVerified;
  const valueBySubject = new Map(data.map(d => [d.subject, d.value]));

  return (
    <div>
      <ResponsiveContainer width="100%" height={h}>
        <RadarChart data={data} margin={{ top: 14, right: 28, bottom: 14, left: 28 }}>
          <defs>
            <linearGradient id="radarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <PolarGrid stroke="#9ca3af" strokeOpacity={0.18} strokeDasharray="2 4" />
          <PolarAngleAxis
            dataKey="subject"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tick={((props: any) => {
              const subject: string = props.payload?.value ?? '';
              const score = valueBySubject.get(subject);
              const short = isMobile && subject.length > 9 ? `${subject.slice(0, 8)}…` : subject;
              return (
                <text
                  x={props.x} y={props.y}
                  textAnchor={props.textAnchor}
                  style={{ fontSize: isMobile ? 10 : 11, fontWeight: 500 }}
                >
                  <tspan fill="#9ca3af">{short}</tspan>
                  {score !== undefined && !isMobile && (
                    <tspan fill="#e5e7eb" fontWeight={700}> {score.toFixed(1)}</tspan>
                  )}
                </text>
              );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 10]}
            tick={{ fontSize: 9, fill: '#6b7280' }}
            tickCount={6}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as DataPoint | undefined;
              const chips = point?.confidence && onPointClick
                ? [t('evidence.clickToSeeEvidence', 'Click the point to see evidence')]
                : undefined;
              return (
                <TooltipContent
                  title={point?.subject}
                  rows={payload.map(p => ({
                    label: String(p.name),
                    value: `${Number(p.value).toFixed(1)} / 10`,
                    color: p.name === t('reports.previous', 'Previous') ? '#9ca3af' : '#818cf8',
                    confidence: p.name !== t('reports.previous', 'Previous') ? point?.confidence : undefined,
                  }))}
                  chips={chips}
                />
              );
            }}
          />
          {hasPrev && <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />}
          {hasPrev && (
            <Radar
              name={t('reports.previous', 'Previous')}
              dataKey="previousValue"
              stroke="#9ca3af"
              fill="#9ca3af"
              fillOpacity={0.1}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              animationDuration={800}
            />
          )}
          <Radar
            name={t('reports.current', 'Current')}
            dataKey="value"
            stroke="#6366f1"
            fill="url(#radarGrad)"
            fillOpacity={1}
            strokeWidth={2}
            strokeDasharray={estimated ? '6 4' : undefined}
            dot={(props: { cx?: number; cy?: number; payload?: DataPoint }) => {
              const { cx, cy, payload } = props;
              const c = payload?.confidence;
              // Confidence dots: VeryHigh green / High blue / Medium amber filled,
              // Low an open gray circle; no confidence = small indigo dot.
              const color = c ? CONFIDENCE_COLORS[c] : '#6366f1';
              const open = c === 'Low';
              return (
                <circle
                  key={payload?.subject}
                  cx={cx} cy={cy}
                  r={c ? 4.5 : 3}
                  fill={open ? 'transparent' : color}
                  stroke={open ? color : '#fff'}
                  strokeWidth={open ? 2 : c ? 1 : 0}
                  style={{ cursor: onPointClick ? 'pointer' : undefined }}
                  onClick={() => payload && onPointClick?.(payload.subject)}
                >
                  {c && <title>{confidenceLabel(c, t)}</title>}
                </circle>
              );
            }}
            animationDuration={800}
          />
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
