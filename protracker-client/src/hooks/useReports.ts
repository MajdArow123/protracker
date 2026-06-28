import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reportsApi';
import { foodAlternativesApi } from '../api/foodAlternativesApi';
import type { PlayerReport, TeamReport, FoodAlternative } from '../types';

export function usePlayerReport(playerId: number | undefined) {
  return useQuery<PlayerReport>({
    queryKey: ['report-player', playerId],
    queryFn: () => reportsApi.getPlayerReport(playerId!),
    enabled: !!playerId,
  });
}

export function useTeamReport(teamId: number | undefined) {
  return useQuery<TeamReport>({
    queryKey: ['report-team', teamId],
    queryFn: () => reportsApi.getTeamReport(teamId!),
    enabled: !!teamId,
  });
}

export function useFoodAlternatives() {
  return useQuery<FoodAlternative[]>({
    queryKey: ['food-alternatives'],
    queryFn: foodAlternativesApi.getAll,
    staleTime: 5 * 60_000,
  });
}
