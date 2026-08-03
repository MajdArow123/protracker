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
