import { useId } from 'react';

interface Props {
  /** Chronological values (oldest first). Needs ≥2 points to render. */
  values: number[];
  width?: number;
  height?: number;
  /** Fixed stroke color; defaults to trend-based (up = emerald, down = red, flat = gray). */
  color?: string;
  strokeWidth?: number;
  className?: string;
}

// Tiny inline trend line with a soft gradient fill — no axes, no labels, no
// tooltip. For stat cards where the number is the message and this is context.
export function Sparkline({ values, width = 96, height = 28, color, strokeWidth = 2, className }: Props) {
  const id = useId();
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = strokeWidth + 1;

  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }));
  const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} ${pts[pts.length - 1].x.toFixed(1)},${height} ${pts[0].x.toFixed(1)},${height}`;

  const first = values[0];
  const last = values[values.length - 1];
  const stroke = color ?? (last > first ? '#10b981' : last < first ? '#ef4444' : '#9ca3af');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={strokeWidth + 0.5} fill={stroke} />
    </svg>
  );
}
