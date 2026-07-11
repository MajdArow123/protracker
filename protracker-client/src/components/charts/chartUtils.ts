import type {
  EvidenceConfidence, ObjectiveTestResult, CoachEvaluationEntry,
  SelfAssessmentEvidence, MatchStatEntry, SportMetricDefinition,
} from '../../types';

export const CONFIDENCE_LEVELS: EvidenceConfidence[] = ['Low', 'Medium', 'High', 'VeryHigh'];

export function confidenceToNumber(c: EvidenceConfidence): number {
  return CONFIDENCE_LEVELS.indexOf(c) + 1; // Low=1 … VeryHigh=4
}

const DAY = 86_400_000;
const EVIDENCE_WINDOW_DAYS = 90;
const OBJECTIVE_FRESH_DAYS = 60;

interface Dated { date: number; metricId: number | null }

// Client-side reconstruction of "data quality over time": at each date an evidence
// item was recorded, re-derive every metric's confidence under the engine's rules
// (sources within 90 days; High needs an objective test within 60) and average
// across metrics that have any evidence. Mirrors EvidenceScoringEngine.GetConfidenceLevel.
export function buildConfidenceTimeline(
  metrics: SportMetricDefinition[],
  tests: ObjectiveTestResult[],
  coachEvals: CoachEvaluationEntry[],
  selfAssessments: SelfAssessmentEvidence[],
  matchStats: MatchStatEntry[],
): { date: number; level: number }[] {
  const testsD: Dated[] = tests.map(x => ({ date: +new Date(x.testedAt), metricId: x.metricDefinitionId }));
  const coachD: Dated[] = coachEvals.map(x => ({ date: +new Date(x.evalDate), metricId: x.metricDefinitionId }));
  const selfD: Dated[] = selfAssessments.map(x => ({ date: +new Date(x.evalDate), metricId: x.metricDefinitionId }));
  const matchD: Dated[] = matchStats.map(x => ({ date: +new Date(x.statDate), metricId: null })); // feeds many metrics

  const eventDates = [...new Set([...testsD, ...coachD, ...selfD, ...matchD].map(e => e.date))]
    .sort((a, b) => a - b);
  if (eventDates.length < 2) return [];

  function levelAt(at: number): number {
    let sum = 0;
    let n = 0;
    for (const metric of metrics) {
      const inWindow = (items: Dated[], forMetric: boolean) => items.some(e =>
        e.date <= at && e.date > at - EVIDENCE_WINDOW_DAYS * DAY
        && (!forMetric || e.metricId === metric.id));
      const hasTest = inWindow(testsD, true);
      const testRecent = testsD.some(e => e.metricId === metric.id
        && e.date <= at && e.date > at - OBJECTIVE_FRESH_DAYS * DAY);
      const hasCoach = inWindow(coachD, true);
      const hasSelf = inWindow(selfD, true);
      const hasMatch = metric.supportsMatchStats && inWindow(matchD, false);
      const count = (hasTest ? 1 : 0) + (hasCoach ? 1 : 0) + (hasSelf ? 1 : 0) + (hasMatch ? 1 : 0);
      if (count === 0) continue;

      const testable = metric.inputType !== 'Rating';
      let level: number;
      if (!testable) level = count >= 2 ? 3 : 1;
      else if (metric.isObjectiveRequired && !hasTest) level = 1;
      else if (hasTest && testRecent && hasMatch && hasCoach && hasSelf) level = 4;
      else if (hasTest && testRecent && count >= 2) level = 3;
      else if (count >= 2) level = 2;
      else level = 1;

      sum += level;
      n += 1;
    }
    return n === 0 ? 0 : Math.round((sum / n) * 100) / 100;
  }

  return eventDates
    .map(date => ({ date, level: levelAt(date) }))
    .filter(p => p.level > 0);
}

// Clamp helper shared by chart components.
export function clampScore(value: number): number {
  return Math.min(10, Math.max(0, value));
}
