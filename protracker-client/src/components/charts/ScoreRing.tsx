import { useEffect, useId, useState } from 'react';
import { clsx } from 'clsx';
import { clampScore } from './chartUtils';
import { scoreTone, type ScoreTone } from './chartColors';

interface Props {
  /** 0-10 score (or a 0-100 percentage with max=100). */
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  /** Text inside the ring; defaults to the value to 1 decimal. */
  display?: string;
  /** Small muted text inside the ring, under the value (e.g. "avg"). */
  sublabel?: string;
  className?: string;
}

// Gradient stops per canonical score band (chartColors.scoreTone: red < 5 ≤ amber < 7 ≤ green).
const RING_STOPS: Record<ScoreTone, [string, string]> = {
  red: ['#ef4444', '#f97316'],
  amber: ['#f59e0b', '#fbbf24'],
  green: ['#10b981', '#34d399'],
};

function ringStops(ratio: number): [string, string] {
  return RING_STOPS[scoreTone(ratio * 10)];
}

// SVG progress ring with a gradient arc, animated fill on mount, big score inside
// and an optional label below. The shared circular indicator for scores/completion.
export function ScoreRing({ value, max = 10, size = 96, strokeWidth = 8, label, display, sublabel, className }: Props) {
  const id = useId();
  const ratio = Math.min(1, Math.max(0, (max === 10 ? clampScore(value) : value) / max));
  const [from, to] = ringStops(ratio);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animate from empty to the target over ~1s via a CSS transition.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const dash = mounted ? circumference * ratio : 0;

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={strokeWidth}
            className="stroke-gray-200 dark:stroke-gray-800"
          />
          {/* Round linecaps paint a dot even at zero length — skip the arc entirely when empty. */}
          {ratio > 0 && (
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" strokeWidth={strokeWidth}
              stroke={`url(#ring-${id})`}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              style={{ transition: 'stroke-dasharray 1s ease-out' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-black text-gray-900 dark:text-white tabular-nums"
            style={{ fontSize: size * 0.26 }}
          >
            {display ?? value.toFixed(1)}
          </span>
          {sublabel && (
            <span className="text-[10px] text-gray-400 leading-none">{sublabel}</span>
          )}
        </div>
      </div>
      {label && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 text-center">{label}</p>
      )}
    </div>
  );
}
