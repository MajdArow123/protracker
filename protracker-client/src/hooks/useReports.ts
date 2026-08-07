import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reportsApi';
import { foodAlternativesApi } from '../api/foodAlternativesApi';
import type { PlayerReport, TeamReport, FoodAlternative, EquivalentFood, PlannedMealItem } from '../types';

export function usePlayerReport(playerId: number | undefined, seasonId?: number) {
  return useQuery<PlayerReport>({
    queryKey: ['report-player', playerId, seasonId ?? null],
    queryFn: () => reportsApi.getPlayerReport(playerId!, seasonId),
    enabled: !!playerId,
  });
}

export function useTeamReport(teamId: number | undefined, seasonId?: number) {
  return useQuery<TeamReport>({
    queryKey: ['report-team', teamId, seasonId ?? null],
    queryFn: () => reportsApi.getTeamReport(teamId!, seasonId),
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

// Portion-scaled equivalents for a specific meal item — powers the swap modal's match badges.
export function useEquivalentFoods(item: PlannedMealItem | null) {
  return useQuery<EquivalentFood[]>({
    queryKey: ['food-equivalents', item?.calories, item?.protein, item?.carbs, item?.fats, item?.foodName],
    queryFn: () => foodAlternativesApi.getEquivalents(item!),
    enabled: !!item,
    staleTime: 5 * 60_000,
  });
}
