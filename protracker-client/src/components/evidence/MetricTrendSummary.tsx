import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight, ArrowUpRight, HelpCircle, Minus, TrendingDown, TrendingUp, Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SCORE_TONE_HEX } from '../charts/chartColors';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { ObjectiveTestResult } from '../../types';

// A directional trend claim needs enough data to back it. Two points always fit
// a perfect line — calling that "improving" is the FINDING-009 failure class
// (confidently wrong). Require ≥3 tests, and refuse to call a direction when the
// least-squares fit is too scattered (low R²) to mean anything.
const MIN_TESTS_FOR_TREND = 3;
const SLOPE_PER_30D_THRESHOLD = 0.25; // normalized-score points per 30 days
const MIN_R2 = 0.3;

export type TrendState =
  | { kind: 'improving' | 'flat' | 'declining'; slopePer30d: number }
  | { kind: 'needsMore' }
  | { kind: 'inconsistent' };

// Least-squares fit of normalizedScore over time (days). Direction is safe for
// lower-is-better tests because normalizedScore already bakes the direction in.
export function computeTrend(tests: ObjectiveTestResult[]): TrendState | null {
  if (tests.length < 2) return null;
  if (tests.length < MIN_TESTS_FOR_TREND) return { kind: 'needsMore' };
  const t0 = new Date(tests[0].testedAt).getTime();
  const pts = tests.map(x => ({
    x: (new Date(x.testedAt).getTime() - t0) / 86_400_000,
    y: x.normalizedScore,
  }));
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const syy = pts.reduce((s, p) => s + (p.y - my) ** 2, 0);
  if (sxx === 0) return { kind: 'inconsistent' }; // all tests on the same day
  const slopePer30d = (sxy / sxx) * 30;
  // syy === 0 → identical scores → genuinely flat; R² is undefined but the call is safe.
  if (syy > 0) {
    const r2 = (sxy * sxy) / (sxx * syy);
    if (r2 < MIN_R2) return { kind: 'inconsistent' };
  }
  if (slopePer30d >= SLOPE_PER_30D_THRESHOLD) return { kind: 'improving', slopePer30d };
  if (slopePer30d <= -SLOPE_PER_30D_THRESHOLD) return { kind: 'declining', slopePer30d };
  return { kind: 'flat', slopePer30d };
}

interface Props {
  /** Tests for ONE metric, sorted oldest → newest. */
  tests: ObjectiveTestResult[];
  unit: string;
  /** Personal-best raw value (direction-aware, computed by the caller). */
  bestValue: number | null;
}

const NEUTRAL = '#9ca3af';

// Summary strip above the progress chart: latest result, raw delta since the
// first test (colored by the direction-safe normalized delta), personal best,
// and the trend chip.
export function MetricTrendSummary({ tests, unit, bestValue }: Props) {
  const { t } = useTranslation();
  const { formatNumber } = useLocaleFormat();
  if (tests.length === 0) return null;

  const first = tests[0];
  const latest = tests[tests.length - 1];
  const rawDelta = latest.value - first.value;
  const scoreDelta = latest.normalizedScore - first.normalizedScore;
  const deltaColor = scoreDelta > 0.05 ? SCORE_TONE_HEX.green : scoreDelta < -0.05 ? SCORE_TONE_HEX.red : NEUTRAL;
  const DeltaIcon = scoreDelta > 0.05 ? ArrowUpRight : scoreDelta < -0.05 ? ArrowDownRight : Minus;

  const trend = computeTrend(tests);
  const trendMeta: Record<TrendState['kind'], { icon: LucideIcon; color: string; label: string }> = {
    improving: { icon: TrendingUp, color: SCORE_TONE_HEX.green, label: t('evidence.trendImproving', 'Improving') },
    flat: { icon: Minus, color: SCORE_TONE_HEX.amber, label: t('evidence.trendFlat', 'Flat') },
    declining: { icon: TrendingDown, color: SCORE_TONE_HEX.red, label: t('evidence.trendDeclining', 'Declining') },
    needsMore: { icon: HelpCircle, color: NEUTRAL, label: t('evidence.trendNeedsThree', 'Trend needs ≥3 tests') },
    inconsistent: { icon: HelpCircle, color: NEUTRAL, label: t('evidence.trendInconsistent', 'Too varied to call') },
  };

  const blocks: { label: string; node: React.ReactNode }[] = [
    {
      label: t('evidence.latest', 'Latest'),
      node: (
        <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
          {formatNumber(latest.value)} <span className="text-[10px] font-semibold text-gray-400">{unit}</span>
        </span>
      ),
    },
  ];

  if (tests.length >= 2) {
    blocks.push({
      label: t('evidence.sinceFirst', 'Since first test'),
      node: (
        <span className="flex items-center gap-1 text-sm font-black tabular-nums" style={{ color: deltaColor }}>
          <DeltaIcon size={14} />
          {rawDelta > 0 ? '+' : ''}{formatNumber(Math.round(rawDelta * 100) / 100)} <span className="text-[10px] font-semibold opacity-70">{unit}</span>
        </span>
      ),
    });
  }

  if (bestValue != null) {
    blocks.push({
      label: t('evidence.personalBestShort', 'Personal best'),
      node: (
        <span className="flex items-center gap-1 text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
          <Trophy size={12} />
          {formatNumber(bestValue)} <span className="text-[10px] font-semibold opacity-70">{unit}</span>
        </span>
      ),
    });
  }

  if (trend) {
    const meta = trendMeta[trend.kind];
    blocks.push({
      label: t('evidence.trend', 'Trend'),
      node: (
        <span
          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ color: meta.color, background: `${meta.color}1f` }}
        >
          <meta.icon size={12} />
          {meta.label}
        </span>
      ),
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {blocks.map(b => (
        <div key={b.label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{b.label}</p>
          {b.node}
        </div>
      ))}
    </div>
  );
}
