import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { soloApi, type SoloProfile } from '../api/soloApi';
import type { CreateSessionInput } from '../api/sessionsApi';
import type { CreateMatchInput } from '../api/matchesApi';
import { useAuth } from '../context/AuthContext';

export function useSoloProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['solo', 'profile', user?.id],
    queryFn: soloApi.getProfile,
    enabled: !!user && user.role === 'SoloAthlete',
    staleTime: 60_000,
  });
}

export function useUpdateSoloProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<SoloProfile, 'skillLevel' | 'trainingFrequency' | 'goals' | 'motivation'>>) =>
      soloApi.updateProfile(patch),
    onSuccess: (profile) => {
      qc.setQueriesData({ queryKey: ['solo', 'profile'] }, profile);
    },
  });
}

// Personal (player-scoped, team-less) sessions & matches. Keys live under the shared
// 'sessions'/'matches' roots so the shared update/delete mutations invalidate them too.
export function useSoloSessions(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['sessions', 'solo'],
    queryFn: soloApi.getSessions,
    enabled: enabled && !!user && user.role === 'SoloAthlete',
    staleTime: 60_000,
  });
}

export function useCreateSoloSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSessionInput) => soloApi.createSession(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useSoloMatches(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['matches', 'solo'],
    queryFn: soloApi.getMatches,
    enabled: enabled && !!user && user.role === 'SoloAthlete',
    staleTime: 60_000,
  });
}

export function useCreateSoloMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMatchInput & { personalRating?: number }) => soloApi.createMatch(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  });
}
