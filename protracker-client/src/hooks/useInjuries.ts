import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { injuryApi } from '../api/injuryApi';
import type { InjuryRecord } from '../types';

export function useInjuries(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['injuries', playerId],
    queryFn: () => injuryApi.getForPlayer(playerId!),
    enabled: !!playerId,
  });
}

/** Active (not fully-recovered) injuries across the coach's teams. */
export function useActiveInjuries(enabled = true) {
  return useQuery({
    queryKey: ['injuries', 'active'],
    queryFn: injuryApi.getActive,
    enabled,
    staleTime: 60_000,
  });
}

export function useRecoverInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => injuryApi.recover(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['injuries'] }),
  });
}

export function useCreateInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: injuryApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['injuries'] }),
  });
}

export function useUpdateInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InjuryRecord> }) =>
      injuryApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['injuries'] }),
  });
}

export function useDeleteInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: injuryApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['injuries'] }),
  });
}
