import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight, ArrowUpRight, HelpCircle, Minus, TrendingDown, TrendingUp, Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SCORE_TONE_HEX } from '../charts/chartColors';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import type { ObjectiveTestResult } from '../../types';
import { computeTrend, type TrendState } from './metricTrend';

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
