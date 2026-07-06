import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { joinApi } from '../api/joinApi';

export function useJoinCodes(teamId: number, enabled = true) {
  return useQuery({
    queryKey: ['joinCodes', teamId],
    queryFn: () => joinApi.getJoinCodes(teamId),
    enabled: enabled && !!teamId,
  });
}

export function useGenerateJoinCode(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { expiresInDays?: number; maxUses?: number }) =>
      joinApi.generateJoinCode(teamId, opts),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['joinCodes', teamId] }),
  });
}

export function useDeactivateJoinCode(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: joinApi.deactivateJoinCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['joinCodes', teamId] }),
  });
}

export function useAthleteInvites(teamId: number, enabled = true) {
  return useQuery({
    queryKey: ['athleteInvites', teamId],
    queryFn: () => joinApi.getAthleteInvites(teamId),
    enabled: enabled && !!teamId,
  });
}

export function useInviteAthlete(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => joinApi.inviteAthlete(teamId, email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['athleteInvites', teamId] });
      qc.invalidateQueries({ queryKey: ['joinCodes', teamId] }); // invite may mint a code
    },
  });
}
