import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nutritionApi } from '../api/nutritionApi';
import type { NutritionGuidance, NutritionProfileItem, SwapMealItemRequest } from '../types';

export function usePlayerNutritionProfile(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['nutrition', 'profile', playerId],
    queryFn: () => nutritionApi.getNutritionProfile(playerId!),
    enabled: !!playerId,
  });
}

export function useCreateProfileItem(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<NutritionProfileItem, 'id' | 'playerId'>) =>
      nutritionApi.createProfileItem(playerId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition', 'profile', playerId] }),
  });
}

export function useUpdateProfileItem(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Omit<NutritionProfileItem, 'id' | 'playerId'> }) =>
      nutritionApi.updateProfileItem(playerId, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition', 'profile', playerId] }),
  });
}

export function useDeleteProfileItem(playerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => nutritionApi.deleteProfileItem(playerId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition', 'profile', playerId] }),
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

export function useUpdateGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<NutritionGuidance> }) =>
      nutritionApi.updateGuidance(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition'] }),
  });
}

export function useWeeklyNutritionPlan(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['nutrition', 'weekly', playerId],
    queryFn: () => nutritionApi.getWeeklyNutritionPlan(playerId!),
    enabled: !!playerId,
    retry: (failCount, error: unknown) => {
      // Don't retry on 404 — player just has no plan yet
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return failCount < 2;
    },
  });
}

export function useGenerateWeeklyNutritionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: number) => nutritionApi.generateWeeklyNutritionPlan(playerId),
    onSuccess: (_data, playerId) => {
      qc.invalidateQueries({ queryKey: ['nutrition', 'weekly', playerId] });
    },
  });
}

export function useSwapMealItem(playerId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mealItemId, data }: { mealItemId: number; data: SwapMealItemRequest }) =>
      nutritionApi.swapMealItem(mealItemId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nutrition', 'weekly', playerId] });
    },
  });
}
