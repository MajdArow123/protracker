import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nutritionApi } from '../api/nutritionApi';
import type { NutritionGuidance } from '../types';

export function usePlayerNutritionProfile(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['nutrition', 'profile', playerId],
    queryFn: () => nutritionApi.getNutritionProfile(playerId!),
    enabled: !!playerId,
  });
}

export function usePlayerNutritionGuidance(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['nutrition', 'guidance', playerId],
    queryFn: () => nutritionApi.getNutritionGuidance(playerId!),
    enabled: !!playerId,
  });
}

export function useCreateGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NutritionGuidance>) => nutritionApi.createGuidance(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition'] }),
  });
}
