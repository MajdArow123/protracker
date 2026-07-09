import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { coachesApi } from '../api/coachesApi';
import type { CoachMarketplaceQuery, UpdateCoachPublicProfileInput } from '../types';

// The current coach's own public-profile settings (lazily created server-side).
export function useCoachPublicSettings(enabled = true) {
  return useQuery({
    queryKey: ['coachPublicProfile', 'settings'],
    queryFn: coachesApi.getSettings,
    enabled,
  });
}

export function useUpdateCoachPublicProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCoachPublicProfileInput) => coachesApi.updateSettings(data),
    onSuccess: (res) => qc.setQueryData(['coachPublicProfile', 'settings'], res),
  });
}

// Public marketplace listing (paginated, filter-aware).
export function useCoachMarketplace(query: CoachMarketplaceQuery) {
  return useQuery({
    queryKey: ['coachMarketplace', query],
    queryFn: () => coachesApi.list(query),
    placeholderData: keepPreviousData,
  });
}

// Anonymous public coach profile for a slug.
export function useCoachPublicView(slug: string | undefined) {
  return useQuery({
    queryKey: ['coachPublicProfile', 'view', slug],
    queryFn: () => coachesApi.getPublic(slug!),
    enabled: !!slug,
    retry: false,
  });
}
