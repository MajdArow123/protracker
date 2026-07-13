// Benchmark standing: where a measured value sits on the CURRENT benchmark
// anchors (Low → Average → Elite). Deliberately computed from the raw value +
// live anchors — NOT from the stored normalizedScore, which was calibrated to
// whatever profile was in force when the test was recorded and goes stale when
// a profile is edited or reassigned. One pure function drives the marker
// position, the tick geometry, the band text AND the tone color, so they can
// never disagree with each other.
//
// Honesty contract: with 3 anchors we can claim a band and a raw distance to
// the next anchor — nothing else. No percentiles (that would be fabricated
// precision), and degenerate anchors return null instead of a made-up claim.

export interface BenchmarkAnchors {
  low: number;
  mid: number;
  high: number;
}

export type StandingBand = 'belowLow' | 'lowToAverage' | 'averageToElite' | 'beyondElite';

export interface Standing {
  band: StandingBand;
  /** 0..1 position on the piecewise scale; ticks sit at 0.3 (Low), 0.5 (Average), 1.0 (Elite). */
  position: number;
  /** Normalized-equivalent score (1-10) on the CURRENT anchors — drives the marker's scoreTone. */
  score: number;
  /** Raw-unit distance to the next anchor toward Elite; null once Elite is reached. */
  gapToNext: { target: 'low' | 'average' | 'elite'; amount: number } | null;
  lowerIsBetter: boolean;
}

// Same piecewise-linear mapping as the backend scoring engine: Low→3, Mid→5,
// High→10, linear between/beyond, clamped to 1..10. Works in both directions
// (lower-is-better anchors have low > mid > high).
export function computeStanding(value: number, anchors: BenchmarkAnchors): Standing | null {
  const { low, mid, high } = anchors;
  const lowerIsBetter = high < low;

  // Anchors must be strictly monotonic in one direction — equal or shuffled
  // anchors (e.g. percentage profiles capped so mid === high) make every band
  // claim meaningless, so refuse rather than divide by zero.
  const monotonic = lowerIsBetter ? low > mid && mid > high : low < mid && mid < high;
  if (!monotonic) return null;

  const score = Math.min(10, Math.max(1,
    (lowerIsBetter ? value <= mid : value >= mid)
      ? 5 + 5 * ((value - mid) / (high - mid))
      : 3 + 2 * ((value - low) / (mid - low)),
  ));
  const position = score / 10;

  // Band from raw comparisons (not from the float score) so anchor-boundary
  // values land deterministically in the upper band.
  const atOrBeyond = (anchor: number) => (lowerIsBetter ? value <= anchor : value >= anchor);
  const band: StandingBand = atOrBeyond(high)
    ? 'beyondElite'
    : atOrBeyond(mid)
      ? 'averageToElite'
      : atOrBeyond(low)
        ? 'lowToAverage'
        : 'belowLow';

  const gap = (anchor: number) => Math.round(Math.abs(anchor - value) * 100) / 100;
  const gapToNext: Standing['gapToNext'] =
    band === 'beyondElite' ? null
    : band === 'averageToElite' ? { target: 'elite', amount: gap(high) }
    : band === 'lowToAverage' ? { target: 'average', amount: gap(mid) }
    : { target: 'low', amount: gap(low) };

  return { band, position, score, gapToNext, lowerIsBetter };
}
