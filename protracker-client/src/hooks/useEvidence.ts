import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  evidenceApi,
  type CreateObjectiveTestInput, type CreateMatchStatInput,
  type CreateCoachEvaluationInput, type CreateSelfAssessmentInput,
} from '../api/evidenceApi';
// Metric definitions are reference data — cache aggressively.
export function useSportMetrics(sportId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['sportMetrics', sportId],
    queryFn: () => evidenceApi.getSportMetrics(sportId!),
    enabled: !!sportId && enabled,
    staleTime: 10 * 60_000,
  });
}

export function usePlayerEvidenceScores(playerId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['evidence', 'scores', playerId],
    queryFn: () => evidenceApi.getEvidenceScores(playerId!),
    enabled: !!playerId && enabled,
  });
}

export function usePlayerObjectiveTests(playerId: number | null | undefined, metricId?: number, enabled = true) {
  return useQuery({
    queryKey: ['evidence', 'tests', playerId, metricId ?? 'all'],
    queryFn: () => evidenceApi.getObjectiveTests(playerId!, metricId),
    enabled: !!playerId && enabled,
  });
}

export function usePlayerMatchStats(playerId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['evidence', 'matchStats', playerId],
    queryFn: () => evidenceApi.getMatchStats(playerId!),
    enabled: !!playerId && enabled,
  });
}

export function usePlayerCoachEvaluations(playerId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['evidence', 'coachEvals', playerId],
    queryFn: () => evidenceApi.getCoachEvaluations(playerId!),
    enabled: !!playerId && enabled,
  });
}

export function usePlayerSelfAssessments(playerId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['evidence', 'selfAssess', playerId],
    queryFn: () => evidenceApi.getSelfAssessments(playerId!),
    enabled: !!playerId && enabled,
  });
}

// Every evidence write immediately recalculates the affected metric(s) so the returned
// score can drive the live preview, then invalidates the cached score list.
export function useAddObjectiveTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateObjectiveTestInput) => {
      const test = await evidenceApi.addObjectiveTest(data);
      const score = await evidenceApi.recalculateMetric(data.playerId, data.metricDefinitionId);
      return { test, score };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['evidence', 'tests', vars.playerId] });
      qc.invalidateQueries({ queryKey: ['evidence', 'scores', vars.playerId] });
    },
  });
}

export function useAddMatchStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateMatchStatInput) => {
      const entry = await evidenceApi.addMatchStats(data);
      // Match stats can feed many metrics at once — recalculate them all.
      const scores = await evidenceApi.recalculateAll(data.playerId);
      return { entry, scores };
    },
    onSuccess: (res, vars) => {
      qc.setQueryData(['evidence', 'scores', vars.playerId], res.scores);
      qc.invalidateQueries({ queryKey: ['evidence', 'matchStats', vars.playerId] });
    },
  });
}

export function useAddCoachEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCoachEvaluationInput) => {
      const evaluation = await evidenceApi.addCoachEvaluation(data);
      const score = await evidenceApi.recalculateMetric(data.playerId, data.metricDefinitionId);
      return { evaluation, score };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['evidence', 'coachEvals', vars.playerId] });
      qc.invalidateQueries({ queryKey: ['evidence', 'scores', vars.playerId] });
    },
  });
}

export function useAddSelfAssessment(playerId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSelfAssessmentInput) => {
      const entry = await evidenceApi.addSelfAssessment(data);
      const score = playerId
        ? await evidenceApi.recalculateMetric(playerId, data.metricDefinitionId)
        : null;
      return { entry, score };
    },
    onSuccess: () => {
      if (!playerId) return;
      qc.invalidateQueries({ queryKey: ['evidence', 'selfAssess', playerId] });
      qc.invalidateQueries({ queryKey: ['evidence', 'scores', playerId] });
    },
  });
}

export function useRecalculateEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: number) => evidenceApi.recalculateAll(playerId),
    onSuccess: (scores, playerId) => {
      qc.setQueryData(['evidence', 'scores', playerId], scores);
    },
  });
}

export function useTeamEvidenceStatus(teamId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['evidence', 'teamStatus', teamId],
    queryFn: () => evidenceApi.getTeamEvidenceStatus(teamId!),
    enabled: !!teamId && enabled,
    staleTime: 60_000,
  });
}

export function useEvidenceReminders(enabled = true) {
  return useQuery({
    queryKey: ['evidence', 'reminders'],
    queryFn: () => evidenceApi.getReminders(),
    enabled,
    staleTime: 5 * 60_000,
  });
}
