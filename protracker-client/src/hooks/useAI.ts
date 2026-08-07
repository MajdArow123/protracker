import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../api/aiApi';
import { useSeasonNoticeToast } from './useSeasonNotice';

export function useGenerateImprovementPlan() {
  const qc = useQueryClient();
  const notifySeason = useSeasonNoticeToast();
  return useMutation({
    mutationFn: (playerId: number) => aiApi.generateImprovementPlan(playerId),
    onSuccess: created => {
      notifySeason(created);
      qc.invalidateQueries({ queryKey: ['improvement'] });
    },
  });
}

export function useGenerateNutritionGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: number) => aiApi.generateNutritionGuidance(playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition'] }),
  });
}

export function useGeneratePerformanceInsights() {
  return useMutation({
    mutationFn: (playerId: number) => aiApi.generatePerformanceInsights(playerId),
  });
}

export function useGenerateTeamInsights() {
  return useMutation({
    mutationFn: (teamId: number) => aiApi.generateTeamInsights(teamId),
  });
}

export function useGenerateTaskSuggestions() {
  return useMutation({
    mutationFn: (playerId: number) => aiApi.generateTaskSuggestions(playerId),
  });
}

export function useGenerateGoalSuggestions() {
  return useMutation({
    mutationFn: (playerId: number) => aiApi.generateGoalSuggestions(playerId),
  });
}

export function useGenerateDrillRecommendations() {
  return useMutation({
    mutationFn: (playerId: number) => aiApi.generateDrillRecommendations(playerId),
  });
}

export function useGenerateEvidenceAnalysis() {
  return useMutation({
    mutationFn: (playerId: number) => aiApi.generateEvidenceAnalysis(playerId),
  });
}
