import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lineupApi, type SaveLineupInput } from '../api/lineupApi';

const lineupKey = (teamId: number, matchId?: number | null) =>
  ['lineup', teamId, matchId ?? 'default'] as const;

export function useLineup(teamId: number | null | undefined, matchId: number | null, enabled = true) {
  return useQuery({
    queryKey: lineupKey(teamId ?? 0, matchId),
    queryFn: () => lineupApi.get(teamId!, matchId),
    enabled: !!teamId && enabled,
  });
}

export function useSaveLineup(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveLineupInput) => lineupApi.save(teamId, data),
    onSuccess: (saved, vars) => {
      qc.setQueryData(lineupKey(teamId, vars.matchResultId ?? null), saved);
    },
  });
}

export function useResetLineup(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: number | null) => lineupApi.reset(teamId, matchId),
    onSuccess: (_res, matchId) => {
      qc.setQueryData(lineupKey(teamId, matchId), null);
    },
  });
}
