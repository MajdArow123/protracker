import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamCoachesApi } from '../api/teamCoachesApi';
import type { CoachPermissions, InviteCoachInput } from '../types';

export function useTeamCoaches(teamId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['teamCoaches', teamId],
    queryFn: () => teamCoachesApi.list(teamId!),
    enabled: !!teamId && enabled,
  });
}

// The current user's own permissions on a team — used to gate assistant-coach UI.
export function useMyCoachPermissions(teamId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['myCoachPermissions', teamId],
    queryFn: () => teamCoachesApi.myPermissions(teamId!),
    enabled: !!teamId && enabled,
  });
}

export function useInviteCoach(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteCoachInput) => teamCoachesApi.invite(teamId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamCoaches', teamId] }),
  });
}

export function useUpdateCoachPermissions(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: number; permissions: CoachPermissions }) =>
      teamCoachesApi.updatePermissions(roleId, permissions),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamCoaches', teamId] }),
  });
}

export function useRemoveCoach(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: number) => teamCoachesApi.remove(roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamCoaches', teamId] }),
  });
}
