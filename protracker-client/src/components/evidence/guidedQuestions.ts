import type { TFunction } from 'i18next';
import type { MetricCategory } from '../../types';

// Guided evaluation questions: three structured questions per metric, tailored by the
// metric's category and parameterized with the metric name. Each answer maps onto the
// 1-10 scale; the final rating is the average of the three answers.

export interface GuidedOption {
  label: (t: TFunction) => string;
  value: number;
}

export interface GuidedQuestion {
  id: string;
  text: (t: TFunction, metricName: string) => string;
  options: GuidedOption[];
}

// Shared 4-point answer scales (worst → best).
const QUALITY: GuidedOption[] = [
  { label: t => t('evidence.q.optPoor', 'Poor'), value: 3 },
  { label: t => t('evidence.q.optDeveloping', 'Developing'), value: 5.5 },
  { label: t => t('evidence.q.optGood', 'Good'), value: 7.5 },
  { label: t => t('evidence.q.optExcellent', 'Excellent'), value: 9.5 },
];

const FREQUENCY: GuidedOption[] = [
  { label: t => t('evidence.q.optRarely', 'Rarely'), value: 3 },
  { label: t => t('evidence.q.optSometimes', 'Sometimes'), value: 5.5 },
  { label: t => t('evidence.q.optUsually', 'Usually'), value: 7.5 },
  { label: t => t('evidence.q.optAlmostAlways', 'Almost always'), value: 9.5 },
];

const PRESSURE: GuidedOption[] = [
  { label: t => t('evidence.q.optFallsApart', 'Falls apart'), value: 3 },
  { label: t => t('evidence.q.optInconsistent', 'Inconsistent'), value: 5.5 },
  { label: t => t('evidence.q.optHandlesWell', 'Handles well'), value: 7.5 },
  { label: t => t('evidence.q.optThrives', 'Thrives under pressure'), value: 9.5 },
];

const LEVEL: GuidedOption[] = [
  { label: t => t('evidence.q.optBelowLevel', 'Below their level'), value: 3 },
  { label: t => t('evidence.q.optAtLevel', 'At their level'), value: 6 },
  { label: t => t('evidence.q.optAboveLevel', 'Above their level'), value: 8 },
  { label: t => t('evidence.q.optElite', 'Among the best'), value: 9.5 },
];

export function guidedQuestionsFor(category: MetricCategory): GuidedQuestion[] {
  switch (category) {
    case 'Physical':
      return [
        { id: 'quality', text: (t, m) => t('evidence.q.physicalQuality', 'How would you rate {{metric}} in training?', { metric: m }), options: QUALITY },
        { id: 'consistency', text: (t, m) => t('evidence.q.physicalConsistency', 'How consistently does it show late in sessions or matches?', { metric: m }), options: FREQUENCY },
        { id: 'level', text: (t, m) => t('evidence.q.compareLevel', 'Compared to players at the same level, {{metric}} is…', { metric: m }), options: LEVEL },
      ];
    case 'Technical':
      return [
        { id: 'accuracy', text: (t, m) => t('evidence.q.technicalAccuracy', 'How accurate/clean is the {{metric}} execution?', { metric: m }), options: FREQUENCY },
        { id: 'pressure', text: (t, m) => t('evidence.q.underPressure', '{{metric}} under pressure:', { metric: m }), options: PRESSURE },
        { id: 'level', text: (t, m) => t('evidence.q.compareLevel', 'Compared to players at the same level, {{metric}} is…', { metric: m }), options: LEVEL },
      ];
    case 'Tactical':
      return [
        { id: 'decisions', text: (t, m) => t('evidence.q.tacticalDecisions', 'How good are the decisions related to {{metric}}?', { metric: m }), options: QUALITY },
        { id: 'reading', text: (t, m) => t('evidence.q.tacticalReading', 'How often do they read the situation before it develops?', { metric: m }), options: FREQUENCY },
        { id: 'pressure', text: (t, m) => t('evidence.q.underPressure', '{{metric}} under pressure:', { metric: m }), options: PRESSURE },
      ];
    case 'Mental':
    case 'Positional':
      return [
        { id: 'quality', text: (t, m) => t('evidence.q.mentalQuality', 'How strong is their {{metric}} overall?', { metric: m }), options: QUALITY },
        { id: 'adversity', text: (t, m) => t('evidence.q.mentalAdversity', 'How do they respond when things go against them?', { metric: m }), options: PRESSURE },
        { id: 'level', text: (t, m) => t('evidence.q.compareLevel', 'Compared to players at the same level, {{metric}} is…', { metric: m }), options: LEVEL },
      ];
  }
}

export function ratingFromAnswers(answers: Record<string, number>): number {
  const values = Object.values(answers);
  if (values.length === 0) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.round(avg * 10) / 10;
}
