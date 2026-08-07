import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSeasonNoticeToast } from './useSeasonNotice';
import { matchPerformanceApi } from '../api/matchPerformanceApi';
import type { MatchPerformance } from '../types';

export function useMatchPerformance(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['matchPerformance', playerId],
    queryFn: () => matchPerformanceApi.getForPlayer(playerId!),
    enabled: !!playerId,
  });
}

export function useCreateMatchPerformance() {
  const notifySeason = useSeasonNoticeToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: matchPerformanceApi.create,
    onSuccess: created => {
      notifySeason(created);
      qc.invalidateQueries({ queryKey: ['matchPerformance'] });
    },
  });
}

export function useUpdateMatchPerformance() {
  const notifySeason = useSeasonNoticeToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MatchPerformance> }) =>
      matchPerformanceApi.update(id, data),
    onSuccess: updated => {
      notifySeason(updated);
      qc.invalidateQueries({ queryKey: ['matchPerformance'] });
    },
  });
}

export function useDeleteMatchPerformance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: matchPerformanceApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matchPerformance'] }),
  });
}
