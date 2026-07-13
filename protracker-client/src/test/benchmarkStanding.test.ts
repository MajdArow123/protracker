import { describe, it, expect } from 'vitest';
import { computeStanding } from '../components/evidence/benchmarkStanding';

// Higher-is-better anchors (dribbling %): Low 40 → Average 60 → Elite 85.
const HIGHER = { low: 40, mid: 60, high: 85 };
// Lower-is-better anchors (30m sprint seconds): Low 4.8 → Average 4.3 → Elite 3.8.
const LOWER = { low: 4.8, mid: 4.3, high: 3.8 };

describe('computeStanding', () => {
  it('places a higher-is-better value in each band with the right gap', () => {
    expect(computeStanding(35, HIGHER)).toMatchObject({
      band: 'belowLow', gapToNext: { target: 'low', amount: 5 },
    });
    expect(computeStanding(50, HIGHER)).toMatchObject({
      band: 'lowToAverage', gapToNext: { target: 'average', amount: 10 },
    });
    expect(computeStanding(70, HIGHER)).toMatchObject({
      band: 'averageToElite', gapToNext: { target: 'elite', amount: 15 },
    });
    expect(computeStanding(90, HIGHER)).toMatchObject({
      band: 'beyondElite', gapToNext: null,
    });
  });

  it('is direction-safe for lower-is-better metrics (sprint getting faster)', () => {
    expect(computeStanding(5.0, LOWER)).toMatchObject({
      band: 'belowLow', gapToNext: { target: 'low', amount: 0.2 }, lowerIsBetter: true,
    });
    expect(computeStanding(4.5, LOWER)).toMatchObject({
      band: 'lowToAverage', gapToNext: { target: 'average', amount: 0.2 },
    });
    expect(computeStanding(4.0, LOWER)).toMatchObject({
      band: 'averageToElite', gapToNext: { target: 'elite', amount: 0.2 },
    });
    expect(computeStanding(3.7, LOWER)).toMatchObject({
      band: 'beyondElite', gapToNext: null,
    });
  });

  it('agrees with itself at every anchor boundary — marker sits exactly on its tick, band lands in the upper segment', () => {
    for (const anchors of [HIGHER, LOWER]) {
      const atLow = computeStanding(anchors.low, anchors)!;
      expect(atLow.position).toBeCloseTo(0.3, 10); // Low tick
      expect(atLow.band).toBe('lowToAverage');

      const atMid = computeStanding(anchors.mid, anchors)!;
      expect(atMid.position).toBeCloseTo(0.5, 10); // Average tick
      expect(atMid.band).toBe('averageToElite');
      expect(atMid.score).toBeCloseTo(5, 10);

      const atHigh = computeStanding(anchors.high, anchors)!;
      expect(atHigh.position).toBeCloseTo(1.0, 10); // Elite tick
      expect(atHigh.band).toBe('beyondElite');
      expect(atHigh.score).toBeCloseTo(10, 10);
    }
  });

  it('interpolates position linearly inside a segment', () => {
    // Halfway Low→Average maps to score 4 → position 0.4 (ticks at 0.3/0.5).
    expect(computeStanding(50, HIGHER)?.position).toBeCloseTo(0.4, 10);
    // Halfway Average→Elite maps to score 7.5 → position 0.75.
    expect(computeStanding(72.5, HIGHER)?.position).toBeCloseTo(0.75, 10);
    expect(computeStanding(4.05, LOWER)?.position).toBeCloseTo(0.75, 10);
  });

  it('clamps far-out values instead of running off the scale', () => {
    expect(computeStanding(0, HIGHER)?.position).toBeCloseTo(0.1, 10);  // score floor 1
    expect(computeStanding(200, HIGHER)?.position).toBeCloseTo(1.0, 10); // score ceiling 10
    expect(computeStanding(9.9, LOWER)?.position).toBeCloseTo(0.1, 10);
    expect(computeStanding(1.0, LOWER)?.position).toBeCloseTo(1.0, 10);
  });

  it('returns null for degenerate anchors rather than fabricating a claim', () => {
    expect(computeStanding(50, { low: 40, mid: 99, high: 99 })).toBeNull(); // capped %: mid === high
    expect(computeStanding(50, { low: 60, mid: 60, high: 85 })).toBeNull(); // low === mid
    expect(computeStanding(50, { low: 40, mid: 90, high: 60 })).toBeNull(); // shuffled
  });

  it('rounds gap amounts to 2 decimals (raw display units)', () => {
    expect(computeStanding(4.456, LOWER)?.gapToNext).toEqual({ target: 'average', amount: 0.16 });
  });
});
