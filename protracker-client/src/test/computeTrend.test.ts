import { describe, it, expect } from 'vitest';
import { computeTrend } from '../components/evidence/MetricTrendSummary';
import type { ObjectiveTestResult } from '../types';

// computeTrend only reads testedAt + normalizedScore; everything else is stub.
function test_(daysFromStart: number, normalizedScore: number, value = 0): ObjectiveTestResult {
  const base = new Date('2026-01-01T10:00:00Z').getTime();
  return {
    id: daysFromStart,
    playerId: 1,
    metricDefinitionId: 1,
    metricName: 'Test',
    value,
    unit: 'seconds',
    testedAt: new Date(base + daysFromStart * 86_400_000).toISOString(),
    testedBy: 'Coach',
    notes: null,
    assessmentId: null,
    normalizedScore,
  };
}

describe('computeTrend', () => {
  it('returns null with fewer than 2 tests (nothing to compare)', () => {
    expect(computeTrend([])).toBeNull();
    expect(computeTrend([test_(0, 5)])).toBeNull();
  });

  it('returns needsMore with exactly 2 tests — two points always fit a perfect line', () => {
    expect(computeTrend([test_(0, 4), test_(30, 8)])).toEqual({ kind: 'needsMore' });
  });

  it('calls improving for 3 collinear rising scores', () => {
    const trend = computeTrend([test_(0, 4), test_(15, 5), test_(30, 6)]);
    expect(trend?.kind).toBe('improving');
    if (trend?.kind === 'improving') expect(trend.slopePer30d).toBeCloseTo(2.0, 5);
  });

  it('calls declining for 3 collinear falling scores', () => {
    const trend = computeTrend([test_(0, 6), test_(15, 5), test_(30, 4)]);
    expect(trend?.kind).toBe('declining');
    if (trend?.kind === 'declining') expect(trend.slopePer30d).toBeCloseTo(-2.0, 5);
  });

  it('refuses to call a direction when the fit is too scattered (low R²)', () => {
    // Spike in the middle: slope ≈ +0.2/30d but R² ≈ 0.004 — any directional
    // claim here would be noise dressed up as insight.
    expect(computeTrend([test_(0, 5), test_(15, 8), test_(30, 5.2)]))
      .toEqual({ kind: 'inconsistent' });
  });

  it('refuses to call a direction when all tests are on the same day (sxx = 0)', () => {
    expect(computeTrend([test_(0, 4), test_(0, 5), test_(0, 6)]))
      .toEqual({ kind: 'inconsistent' });
  });

  it('calls flat for identical scores (syy = 0 is genuinely flat, not an error)', () => {
    const trend = computeTrend([test_(0, 7), test_(10, 7), test_(20, 7)]);
    expect(trend?.kind).toBe('flat');
    if (trend?.kind === 'flat') expect(trend.slopePer30d).toBe(0);
  });

  it('calls small consistent drift flat, not improving (below slope threshold)', () => {
    // +0.2 over 60 days = +0.1/30d — collinear (R² = 1) but too slow to claim.
    const trend = computeTrend([test_(0, 6.0), test_(30, 6.1), test_(60, 6.2)]);
    expect(trend?.kind).toBe('flat');
  });

  it('is direction-safe for lower-is-better metrics: raw value drops, normalized rises → improving', () => {
    // A sprinter getting faster: raw seconds fall while normalizedScore
    // (direction already baked in upstream) rises.
    const trend = computeTrend([
      test_(0, 3.4, 4.7),
      test_(20, 4.2, 4.5),
      test_(40, 6.0, 4.2),
    ]);
    expect(trend?.kind).toBe('improving');
  });
});
