// Coverage honesty for team-level rollups (Phase G continuation, Section 6).
// A squad average built from a fraction of the roster is not authoritative —
// this pure helper decides how confidently a stat may present itself, the same
// claim-gating pattern as computeTrend (S4) and computeStanding (S5).

export type CoverageLevel = 'none' | 'thin' | 'partial' | 'good';

// Fewer than this many scored players is always thin, whatever the ratio —
// an "average" of two people is an anecdote.
export const MIN_SCORED_FOR_CONFIDENCE = 3;
export const THIN_RATIO = 0.5;
export const GOOD_RATIO = 0.8;

export function coverageLevel(scored: number, squadSize: number): CoverageLevel {
  if (scored <= 0 || squadSize <= 0) return 'none';
  if (scored < MIN_SCORED_FOR_CONFIDENCE) return 'thin';
  const ratio = scored / squadSize;
  if (ratio < THIN_RATIO) return 'thin';
  if (ratio < GOOD_RATIO) return 'partial';
  return 'good';
}
