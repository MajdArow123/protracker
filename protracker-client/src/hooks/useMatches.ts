import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchesApi, type CreateMatchInput, type RatingInput } from '../api/matchesApi';

export function useTeamMatches(teamId: number | null | undefined) {
  return useQuery({
    queryKey: ['matches', 'team', teamId],
    queryFn: () => matchesApi.getForTeam(teamId!),
    enabled: !!teamId,
  });
}

export function usePlayerMatchRatings(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['matches', 'player', playerId],
    queryFn: () => matchesApi.getPlayerRatings(playerId!),
    enabled: !!playerId,
  });
}

export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: number; data: CreateMatchInput }) => matchesApi.create(teamId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  });
}

export function useUpdateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateMatchInput }) => matchesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  });
}

export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => matchesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  });
}

export function useSaveMatchRatings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ratings }: { id: number; ratings: RatingInput[] }) => matchesApi.saveRatings(id, ratings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  });
}
