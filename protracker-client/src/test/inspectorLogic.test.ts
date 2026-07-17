import { describe, it, expect } from 'vitest';
import { wellbeingRecency, topTrends } from '../components/teams/lineup/inspectorLogic';
import type { ObjectiveTestResult, WellbeingCheckin } from '../types';

const checkin = (date: string, energy = 4): WellbeingCheckin => ({
  id: 1, playerId: 1, date, feeling: 3, energy, sleep: 4,
  hasPain: false, score: 7.3, createdAt: date,
});

const NOW = new Date('2026-07-17T12:00:00Z');

describe('wellbeingRecency', () => {
  it('returns null when no check-ins exist (→ the not-recorded state, never a default)', () => {
    expect(wellbeingRecency([], NOW)).toBeNull();
  });

  it('picks the LATEST check-in and reports whole days ago', () => {
    const r = wellbeingRecency([
      checkin('2026-07-10T00:00:00Z', 2),
      checkin('2026-07-16T00:00:00Z', 5),
      checkin('2026-07-01T00:00:00Z', 1),
    ], NOW)!;
    expect(r.checkin.energy).toBe(5);
    expect(r.daysAgo).toBe(1);
  });

  it('today is 0 days ago; clock skew never goes negative', () => {
    expect(wellbeingRecency([checkin('2026-07-17T09:00:00Z')], NOW)!.daysAgo).toBe(0);
    expect(wellbeingRecency([checkin('2026-07-18T00:00:00Z')], NOW)!.daysAgo).toBe(0);
  });
});

let testId = 0;
const test = (metricId: number, testedAt: string, value: number, normalizedScore: number): ObjectiveTestResult => ({
  id: ++testId, playerId: 1, metricDefinitionId: metricId, metricName: `Metric ${metricId}`,
  value, unit: 's', testedAt, testedBy: 'Coach', notes: null, assessmentId: null, normalizedScore,
});

describe('topTrends', () => {
  it('groups by metric, newest-tested metric first, and applies computeTrend gates verbatim', () => {
    const rows = topTrends([
      // metric 1: 3 collinear rising tests → improving (computeTrend's call, not ours)
      test(1, '2026-05-01T00:00:00Z', 4.5, 5),
      test(1, '2026-06-01T00:00:00Z', 4.3, 6),
      test(1, '2026-07-01T00:00:00Z', 4.1, 7),
      // metric 2: a single test → NO trend claim of any kind
      test(2, '2026-07-10T00:00:00Z', 30, 6),
      // metric 3: two tests → needsMore, never a direction
      test(3, '2026-06-20T00:00:00Z', 10, 5),
      test(3, '2026-07-05T00:00:00Z', 11, 6),
    ]);

    expect(rows.map(r => r.metricDefinitionId)).toEqual([2, 3, 1]); // newest latest-test first
    expect(rows.find(r => r.metricDefinitionId === 1)!.trend).toMatchObject({ kind: 'improving' });
    expect(rows.find(r => r.metricDefinitionId === 2)!.trend).toBeNull();
    expect(rows.find(r => r.metricDefinitionId === 3)!.trend).toEqual({ kind: 'needsMore' });
  });

  it('sorts each metric oldest → newest before computeTrend, even from unsorted input', () => {
    const rows = topTrends([
      test(1, '2026-07-01T00:00:00Z', 4.1, 7), // newest given first
      test(1, '2026-05-01T00:00:00Z', 4.5, 5),
      test(1, '2026-06-01T00:00:00Z', 4.3, 6),
    ]);
    expect(rows[0].trend).toMatchObject({ kind: 'improving' });
    expect(rows[0].latest.value).toBe(4.1);
    expect(rows[0].testCount).toBe(3);
  });

  it('caps at the limit and reports empty input as an empty list', () => {
    const many = Array.from({ length: 8 }, (_, i) => test(i + 1, `2026-07-0${(i % 7) + 1}T00:00:00Z`, 5, 5));
    expect(topTrends(many, 5)).toHaveLength(5);
    expect(topTrends([])).toEqual([]);
  });
});
