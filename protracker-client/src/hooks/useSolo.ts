import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { soloApi, type SoloProfile } from '../api/soloApi';
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

// Full personal training calendar (past + upcoming, player-scoped sessions).
export function useSoloSessions(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['solo', 'sessions'],
    queryFn: soloApi.getSessions,
    enabled: enabled && !!user && user.role === 'SoloAthlete',
    staleTime: 60_000,
  });
}

export function useSoloMatches(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['solo', 'matches'],
    queryFn: soloApi.getMatches,
    enabled: enabled && !!user && user.role === 'SoloAthlete',
    staleTime: 60_000,
  });
}
