import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../api/aiApi';

export function useGenerateImprovementPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: number) => aiApi.generateImprovementPlan(playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['improvement'] }),
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
