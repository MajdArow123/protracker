import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsApi, type CreateSessionInput } from '../api/sessionsApi';

export function useTeamSessions(teamId: number | null | undefined) {
  return useQuery({
    queryKey: ['sessions', 'team', teamId],
    queryFn: () => sessionsApi.getForTeam(teamId!),
    enabled: !!teamId,
  });
}

export function useMySessions(enabled = true) {
  return useQuery({
    queryKey: ['sessions', 'mine'],
    queryFn: () => sessionsApi.getMine(),
    enabled,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: number; data: CreateSessionInput }) => sessionsApi.create(teamId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateSessionInput }) => sessionsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sessionsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}
