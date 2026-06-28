import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nutritionApi } from '../api/nutritionApi';
import type { NutritionGuidance, NutritionProfileItem } from '../types';

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
