import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '../api/teamsApi';
import type { Team } from '../types';

export function useTeams(enabled = true) {
  return useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.getTeams,
    staleTime: 60_000,
    enabled,
  });
}

export function useTeam(id: number | undefined) {
  return useQuery({
    queryKey: ['teams', id],
    queryFn: () => teamsApi.getTeam(id!),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamsApi.createTeam,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Team> }) =>
      teamsApi.updateTeam(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: teamsApi.deleteTeam,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}
