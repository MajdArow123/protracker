import type { EvidenceConfidence, EvidenceBasedScore } from '../../types';
import type { TFunction } from 'i18next';

// ── Confidence styling & labels ──────────────────────────────────────────────

export const CONFIDENCE_ORDER: EvidenceConfidence[] = ['Low', 'Medium', 'High', 'VeryHigh'];

export function confidenceLabel(c: EvidenceConfidence, t: TFunction): string {
  switch (c) {
    case 'Low': return t('evidence.confidenceLow', 'Low');
    case 'Medium': return t('evidence.confidenceMedium', 'Medium');
    case 'High': return t('evidence.confidenceHigh', 'High');
    case 'VeryHigh': return t('evidence.confidenceVeryHigh', 'Very High');
  }
}

// Badge classes per confidence level (light + dark). Status colors are consistent
// app-wide: Low = gray, Medium = amber, High = blue, VeryHigh = green.
export function confidenceBadgeClass(c: EvidenceConfidence): string {
  switch (c) {
    case 'Low': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    case 'Medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'High': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'VeryHigh': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  }
}

export function confidenceDotColor(c: EvidenceConfidence): string {
  switch (c) {
    case 'Low': return '#9ca3af';
    case 'Medium': return '#f59e0b';
    case 'High': return '#3b82f6';
    case 'VeryHigh': return '#10b981';
  }
}

export function isVerified(c: EvidenceConfidence): boolean {
  return c === 'High' || c === 'VeryHigh';
}

// Round an evidence score (0.1 precision) onto the slider's 0.5-step scale.
export function toSliderStep(score: number): number {
  return Math.min(10, Math.max(1, Math.round(score * 2) / 2));
}

// Translate the backend's evidence-source keywords for display. The backend sends a small
// fixed vocabulary ("coach evaluation", "match stats", ...) plus free-form test descriptions.
export function translateEvidenceItem(item: string, t: TFunction): string {
  if (item.startsWith('objective test')) return t('evidence.sourceObjective', 'Objective test') + item.replace('objective test', '');
  if (item === 'match stats') return t('evidence.sourceMatchStats', 'Match stats');
  if (item === 'coach evaluation') return t('evidence.sourceCoachEval', 'Coach evaluation');
  if (item === 'self-assessment') return t('evidence.sourceSelfAssess', 'Self-assessment');
  return item;
}

// One-line "why this confidence?" for badge tooltips.
export function confidenceExplanation(score: EvidenceBasedScore, t: TFunction): string {
  const level = confidenceLabel(score.confidence, t);
  if (!score.isObjectiveTestable) {
    return t('evidence.whyUntestable', 'Why {{level}}? This metric is rated by observation — two sources (coach + self-assessment) give the highest possible confidence.', { level });
  }
  if (score.daysSinceObjectiveTest == null) {
    return t('evidence.whyNoTest', 'Why {{level}}? No objective test recorded. Add a measured test to reach High confidence.', { level });
  }
  if (score.isObjectiveTestExpired) {
    return t('evidence.whyExpired', 'Why {{level}}? The last objective test was {{days}} days ago (older than 60 days). Run a new test to restore High confidence.', { level, days: score.daysSinceObjectiveTest });
  }
  return t('evidence.whyFresh', '{{level}} confidence — based on an objective test from {{days}} days ago plus {{count}} evidence sources.', {
    level, days: score.daysSinceObjectiveTest, count: score.evidenceSources.length,
  });
}

// Most common confidence across a player's scores (the "overall" level).
export function overallConfidence(scores: EvidenceBasedScore[]): EvidenceConfidence | null {
  if (scores.length === 0) return null;
  const counts = new Map<EvidenceConfidence, number>();
  for (const s of scores) counts.set(s.confidence, (counts.get(s.confidence) ?? 0) + 1);
  let best: EvidenceConfidence = 'Low';
  let bestCount = -1;
  for (const c of CONFIDENCE_ORDER) {
    const n = counts.get(c) ?? 0;
    if (n >= bestCount && n > 0) { best = c; bestCount = n; }
  }
  return best;
}
