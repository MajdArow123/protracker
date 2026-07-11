interface Props {
  /** 0–10 scores, one per axis. Needs ≥3 to draw a polygon. */
  values: number[];
  size?: number;
  color?: string;
  className?: string;
}

// Thumbnail radar: just the grid rings and the score polygon, no labels.
// Gives team/player cards a shape-of-the-athlete glance without a full chart.
export function MiniRadar({ values, size = 72, color = '#6366f1', className }: Props) {
  if (values.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;
  const angle = (i: number) => (Math.PI * 2 * i) / values.length - Math.PI / 2;

  const ring = (scale: number) =>
    values
      .map((_, i) => `${(cx + Math.cos(angle(i)) * r * scale).toFixed(1)},${(cy + Math.sin(angle(i)) * r * scale).toFixed(1)}`)
      .join(' ');

  const poly = values
    .map((v, i) => {
      const scale = Math.min(10, Math.max(0, v)) / 10;
      return `${(cx + Math.cos(angle(i)) * r * scale).toFixed(1)},${(cy + Math.sin(angle(i)) * r * scale).toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true">
      {[1, 0.66, 0.33].map(s => (
        <polygon key={s} points={ring(s)} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={1} />
      ))}
      <polygon points={poly} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
