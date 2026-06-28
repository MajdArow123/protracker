import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { improvementApi } from '../api/improvementApi';

export function usePlayerImprovementPlans(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['improvement', playerId],
    queryFn: () => improvementApi.getPlayerPlans(playerId!),
    enabled: !!playerId,
  });
}

export function useCreateImprovementPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: improvementApi.createPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['improvement'] }),
  });
}

export function useUpdateImprovementPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<import('../types').ImprovementPlan> }) =>
      improvementApi.updatePlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['improvement'] }),
  });
}
