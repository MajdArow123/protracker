import type { SeasonResolutionNotice } from './assessment';

// ── Evidence-based assessments (Phase G) ─────────────────────────────────────
export type MetricCategory = 'Physical' | 'Technical' | 'Tactical' | 'Mental' | 'Positional';
export type MetricInputType = 'Timer' | 'Weight' | 'Distance' | 'Percentage' | 'Count' | 'Rating' | 'Boolean';
export type EvidenceConfidence = 'Low' | 'Medium' | 'High' | 'VeryHigh';

export interface SportMetricDefinition {
  id: number;
  sportId: number;
  name: string;
  shortName: string | null;
  category: MetricCategory;
  description: string | null;
  unit: string | null;
  inputType: MetricInputType;
  objectiveTestWeight: number;
  matchStatWeight: number;
  coachEvalWeight: number;
  selfAssessWeight: number;
  isObjectiveRequired: boolean;
  benchmarkLow: number;
  benchmarkMid: number;
  benchmarkHigh: number;
  notes: string | null;
  sportStatCategoryId: number | null;
  supportsMatchStats: boolean;
  testSetup: string | null;
  testProcedure: string | null;
  commonMistakes: string | null;
  videoUrl: string | null;
}

export interface ObjectiveTestResult {
  id: number;
  seasonNotice?: SeasonResolutionNotice | null;
  playerId: number;
  metricDefinitionId: number;
  metricName: string;
  value: number;
  unit: string;
  testedAt: string;
  testedBy: 'Coach' | 'Athlete' | 'ThirdParty';
  notes: string | null;
  assessmentId: number | null;
  normalizedScore: number;
}

export interface MatchStatEntry {
  id: number;
  playerId: number;
  matchResultId: number | null;
  statDate: string;
  sportId: number;
  stats: Record<string, number>;
  notes: string | null;
  isAutoImported: boolean;
}

export interface CoachEvaluationEntry {
  id: number;
  playerId: number;
  metricDefinitionId: number;
  metricName: string;
  rating: number;
  evalDate: string;
  notes: string | null;
  assessmentId: number | null;
}

export interface SelfAssessmentEvidence {
  id: number;
  playerId: number;
  metricDefinitionId: number;
  metricName: string;
  rating: number;
  evalDate: string;
  guidedAnswers: string | null;
  notes: string | null;
}

export interface EvidenceBasedScore {
  id: number;
  playerId: number;
  metricDefinitionId: number;
  metricName: string;
  metricCategory: MetricCategory;
  sportStatCategoryId: number | null;
  assessmentId: number | null;
  finalScore: number;
  confidence: EvidenceConfidence;
  calculationMethod: 'Manual' | 'Calculated' | 'Hybrid';
  objectiveScore: number | null;
  matchStatScore: number | null;
  coachEvalScore: number | null;
  selfAssessScore: number | null;
  objectiveWeight: number;
  matchStatWeight: number;
  coachEvalWeight: number;
  selfAssessWeight: number;
  evidenceSources: string[];
  explanation: string | null;
  missingEvidence: string[];
  lastCalculatedAt: string;
  isObjectiveTestable: boolean;
  isObjectiveTestExpired: boolean;
  daysSinceObjectiveTest: number | null;
  nextObjectiveTestDue: string | null;
}

// Per-team batch payload: one roster player's current evidence scores.
export interface PlayerEvidenceScores {
  playerId: number;
  scores: EvidenceBasedScore[];
}

export interface EvidencePriority {
  metric: string;
  action: string;
  reason: string;
}

export interface EvidenceAnalysis {
  playerId: number;
  playerName: string;
  summary: string;
  priorities: EvidencePriority[];
  testBattery: string[];
  roadmap: string[];
  generatedAt: string;
}

export interface PlayerEvidenceStatus {
  playerId: number;
  playerName: string;
  jerseyNumber: number | null;
  scoredMetrics: number;
  verifiedMetrics: number;
  overallConfidence: EvidenceConfidence | null;
  lastTestAt: string | null;
  testCount: number;
  matchStatCount: number;
}

export interface TeamEvidenceStatus {
  teamId: number;
  totalMetrics: number;
  players: PlayerEvidenceStatus[];
  playersNeedingTests: number;
  playersWithoutMatchStats: number;
  playersWithoutEvidence: number;
}

// ── Team performance analytics (Phase G continuation, Section 6) ─────────────

export interface TeamMetricOutlier {
  playerId: number;
  playerName: string;
  score: number;
}

export interface TeamMetricPerformance {
  metricDefinitionId: number;
  name: string;
  category: string;
  unit: string | null;
  scoredCount: number;
  verifiedCount: number;
  average: number | null;
  min: number | null;
  max: number | null;
  /** Sample (n-1) std dev; null when fewer than 4 players are scored. */
  stdDev: number | null;
  bandCounts: { red: number; amber: number; green: number };
  /** Players with blended FinalScore < 5 — the app scale's average, not a cohort benchmark. */
  belowAverageCount: number;
  lowOutliers: TeamMetricOutlier[];
  highOutliers: TeamMetricOutlier[];
}

export interface TeamEvidencePerformance {
  teamId: number;
  squadSize: number;
  benchmarkProfileId: number | null;
  profileName: string | null;
  metrics: TeamMetricPerformance[];
}

export interface EvidenceReminder {
  type: 'NoRecentTest' | 'LowConfidence' | 'ExpiredTests';
  playerId: number | null;
  playerName: string | null;
  teamId: number | null;
  teamName: string | null;
  daysSinceTest: number | null;
  count: number | null;
}

// ── Benchmark calibration (Phase G accuracy round) ───────────────────────────
export type CompetitionLevel = 'Recreational' | 'Amateur' | 'SemiPro' | 'Professional';

export interface BenchmarkValue {
  metricDefinitionId: number;
  metricName: string;
  unit: string | null;
  inputType: string;
  benchmarkLow: number;
  benchmarkMid: number;
  benchmarkHigh: number;
  notes: string | null;
}

export interface BenchmarkProfile {
  id: number;
  sportId: number;
  name: string;
  ageGroupMin: number | null;
  ageGroupMax: number | null;
  competitionLevel: CompetitionLevel;
  isDefault: boolean;
  isMine: boolean;
  values: BenchmarkValue[];
}

export interface TeamBenchmarkProfile {
  teamId: number;
  benchmarkProfileId: number | null;
  profileName: string | null;
}

export interface PlayerBenchmarks {
  playerId: number;
  benchmarkProfileId: number | null;
  profileName: string | null;
  values: Record<number, BenchmarkValue>;
}
