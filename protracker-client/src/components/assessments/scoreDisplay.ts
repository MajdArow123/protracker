import { scoreTone, SCORE_TONE_HEX } from '../charts/chartColors';

// Score → color/label helpers shared by the slider widgets and the evidence
// surfaces. Thresholds mirror scoreTone/chartColors — keep in sync.

export function scoreColor(score: number) {
  return SCORE_TONE_HEX[scoreTone(score)];
}

const SCORE_LABELS = {
  green: { text: 'Good', key: 'scoreGood', cls: 'text-green-500 bg-green-500/10' },
  amber: { text: 'Fair', key: 'scoreFair', cls: 'text-amber-500 bg-amber-500/10' },
  red: { text: 'Low', key: 'scoreLow', cls: 'text-red-500 bg-red-500/10' },
} as const;

export function scoreLabel(score: number) {
  return SCORE_LABELS[scoreTone(score)];
}
