import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { drillsApi, type DrillFilters, type CreateDrillInput, type AssignDrillInput } from '../api/drillsApi';

export function useDrills(filters: DrillFilters = {}, enabled = true) {
  return useQuery({
    queryKey: ['drills', 'list', filters],
    queryFn: () => drillsApi.list(filters),
    enabled,
    placeholderData: keepPreviousData,
  });
}

// Non-AI recommendations: drills matching a player's weakest assessment areas.
export function useRecommendedDrills(playerId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['drills', 'recommended', playerId],
    queryFn: () => drillsApi.recommended(playerId!),
    enabled: !!playerId && enabled,
  });
}

export function useDrill(id: number | undefined) {
  return useQuery({
    queryKey: ['drills', 'detail', id],
    queryFn: () => drillsApi.get(id!),
    enabled: !!id,
  });
}

export function useDrillAnalytics(enabled = true) {
  return useQuery({
    queryKey: ['drills', 'analytics'],
    queryFn: drillsApi.analytics,
    enabled,
  });
}

export function useCreateDrill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDrillInput) => drillsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drills'] }),
  });
}

export function useUpdateDrill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateDrillInput }) => drillsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drills'] }),
  });
}

export function useDeleteDrill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => drillsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drills'] }),
  });
}

export function useToggleDrillFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => drillsApi.toggleFavorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drills'] }),
  });
}

export function useAssignDrill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssignDrillInput }) => drillsApi.assign(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
