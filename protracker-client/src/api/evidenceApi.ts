import api from './axiosInstance';
import type {
  SportMetricDefinition, ObjectiveTestResult, MatchStatEntry,
  CoachEvaluationEntry, SelfAssessmentEvidence, EvidenceBasedScore,
} from '../types';

export interface CreateObjectiveTestInput {
  playerId: number;
  metricDefinitionId: number;
  value: number;
  unit?: string | null;
  testedAt?: string | null;
  notes?: string | null;
  assessmentId?: number | null;
}

export interface CreateMatchStatInput {
  playerId: number;
  statDate?: string | null;
  stats: Record<string, number>;
  matchResultId?: number | null;
  notes?: string | null;
}

export interface CreateCoachEvaluationInput {
  playerId: number;
  metricDefinitionId: number;
  rating: number;
  evalDate?: string | null;
  notes?: string | null;
  assessmentId?: number | null;
}

export interface CreateSelfAssessmentInput {
  metricDefinitionId: number;
  rating: number;
  evalDate?: string | null;
  guidedAnswers?: string | null;
  notes?: string | null;
  assessmentId?: number | null;
}

export const evidenceApi = {
  getSportMetrics: (sportId: number) =>
    api.get<SportMetricDefinition[]>(`/api/sport-metrics/${sportId}`).then(r => r.data),

  addObjectiveTest: (data: CreateObjectiveTestInput) =>
    api.post<ObjectiveTestResult>('/api/objective-tests', data).then(r => r.data),
  getObjectiveTests: (playerId: number, metricId?: number) =>
    api.get<ObjectiveTestResult[]>(`/api/players/${playerId}/objective-tests${metricId ? `?metricId=${metricId}` : ''}`).then(r => r.data),

  addMatchStats: (data: CreateMatchStatInput) =>
    api.post<MatchStatEntry>('/api/match-stats', data).then(r => r.data),
  getMatchStats: (playerId: number) =>
    api.get<MatchStatEntry[]>(`/api/players/${playerId}/match-stats`).then(r => r.data),

  addCoachEvaluation: (data: CreateCoachEvaluationInput) =>
    api.post<CoachEvaluationEntry>('/api/coach-evaluations', data).then(r => r.data),
  getCoachEvaluations: (playerId: number) =>
    api.get<CoachEvaluationEntry[]>(`/api/players/${playerId}/coach-evaluations`).then(r => r.data),

  addSelfAssessment: (data: CreateSelfAssessmentInput) =>
    api.post<SelfAssessmentEvidence>('/api/self-assessments/evidence', data).then(r => r.data),
  getSelfAssessments: (playerId: number) =>
    api.get<SelfAssessmentEvidence[]>(`/api/players/${playerId}/self-assessments`).then(r => r.data),

  getEvidenceScores: (playerId: number) =>
    api.get<EvidenceBasedScore[]>(`/api/players/${playerId}/evidence-scores`).then(r => r.data),
  recalculateAll: (playerId: number) =>
    api.post<EvidenceBasedScore[]>(`/api/evidence-scores/calculate/${playerId}`).then(r => r.data),
  recalculateMetric: (playerId: number, metricId: number) =>
    api.post<EvidenceBasedScore | null>(`/api/evidence-scores/calculate/${playerId}/${metricId}`).then(r => r.data),
};
