import { computeTrend, type TrendState } from '../../evidence/MetricTrendSummary';
import type { ObjectiveTestResult, WellbeingCheckin } from '../../../types';

// Pure logic for the Player Inspector (Phase 2) — exported and unit-tested
// (src/test/inspectorLogic.test.ts). Both take `now`/data as parameters so the
// honesty gates are testable without a clock or a DOM.
//
// Absence semantics (encoded here, asserted in tests): an empty TASK/GOAL/
// INJURY list is a real fact ("No open tasks") — plain text, not a missing
// state. A missing periodic MEASUREMENT (no wellbeing check-in) is
// 'not-recorded'. An attribute the app never measures (form) is 'not-tracked'.
// A failed request is 'load-failed' and never masquerades as any of these.

export interface WellbeingRecency {
  checkin: WellbeingCheckin;
  /** Whole days between the check-in date and `now` (0 = today). */
  daysAgo: number;
}

/** Latest check-in + its age, or null when none exist (→ not-recorded state). */
export function wellbeingRecency(checkins: readonly WellbeingCheckin[], now: Date): WellbeingRecency | null {
  if (checkins.length === 0) return null;
  const latest = [...checkins].sort((a, b) => b.date.localeCompare(a.date))[0];
  const days = Math.floor((now.getTime() - new Date(latest.date).getTime()) / 86_400_000);
  return { checkin: latest, daysAgo: Math.max(0, days) };
}

export interface MetricTrendSummaryRow {
  metricDefinitionId: number;
  metricName: string;
  unit: string;
  /** Newest test for the metric (drives "latest value" + standing). */
  latest: ObjectiveTestResult;
  testCount: number;
  /** computeTrend verbatim; null = a single test (no claim of any kind). */
  trend: TrendState | null;
}

/**
 * Group a player's objective tests by metric, newest-tested metrics first,
 * with the S4 trend gates applied per metric via `computeTrend` (reused
 * verbatim — ≥3 tests for a direction, R² gate, same-day inconsistency).
 */
export function topTrends(tests: readonly ObjectiveTestResult[], limit = 5): MetricTrendSummaryRow[] {
  const byMetric = new Map<number, ObjectiveTestResult[]>();
  for (const t of tests) {
    const arr = byMetric.get(t.metricDefinitionId);
    if (arr) arr.push(t); else byMetric.set(t.metricDefinitionId, [t]);
  }
  const rows: MetricTrendSummaryRow[] = [];
  for (const arr of byMetric.values()) {
    arr.sort((a, b) => a.testedAt.localeCompare(b.testedAt)); // oldest → newest (computeTrend contract)
    const latest = arr[arr.length - 1];
    rows.push({
      metricDefinitionId: latest.metricDefinitionId,
      metricName: latest.metricName,
      unit: latest.unit,
      latest,
      testCount: arr.length,
      trend: computeTrend(arr),
    });
  }
  rows.sort((a, b) => b.latest.testedAt.localeCompare(a.latest.testedAt));
  return rows.slice(0, limit);
}
