import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { benchmarksApi, type CreateBenchmarkProfileInput } from '../api/benchmarksApi';

export function useBenchmarkProfiles(sportId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['benchmarks', 'profiles', sportId],
    queryFn: () => benchmarksApi.getProfiles(sportId!),
    enabled: !!sportId && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useTeamBenchmarkProfile(teamId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['benchmarks', 'team', teamId],
    queryFn: () => benchmarksApi.getTeamProfile(teamId!),
    enabled: !!teamId && enabled,
  });
}

// The calibration in force for one player — drives evidence hints/badges.
export function usePlayerBenchmarks(playerId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['benchmarks', 'player', playerId],
    queryFn: () => benchmarksApi.getPlayerBenchmarks(playerId!),
    enabled: !!playerId && enabled,
    staleTime: 60_000,
  });
}

export function useCreateBenchmarkProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBenchmarkProfileInput) => benchmarksApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchmarks'] }),
  });
}

export function useUpdateBenchmarkProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateBenchmarkProfileInput }) => benchmarksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchmarks'] }),
  });
}

export function useDeleteBenchmarkProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => benchmarksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchmarks'] }),
  });
}

export function useSetTeamBenchmarkProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, profileId }: { teamId: number; profileId: number | null }) =>
      benchmarksApi.setTeamProfile(teamId, profileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['benchmarks'] });
      // Calibration changed — recorded scores/hints for this team's players are stale.
      qc.invalidateQueries({ queryKey: ['evidence'] });
    },
  });
}
