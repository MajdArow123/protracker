import {
  useQuery, useMutation, useQueryClient, keepPreviousData, useInfiniteQuery,
} from '@tanstack/react-query';
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

// Public marketplace listing (single page, filter-aware).
export function useCoachMarketplace(query: CoachMarketplaceQuery) {
  return useQuery({
    queryKey: ['coachMarketplace', query],
    queryFn: () => coachesApi.list(query),
    placeholderData: keepPreviousData,
  });
}

// Infinite ("Load more") marketplace listing. The page param lives outside the key so
// changing any filter starts a fresh accumulation.
export function useCoachMarketplaceInfinite(filters: Omit<CoachMarketplaceQuery, 'page'>) {
  return useInfiniteQuery({
    queryKey: ['coachMarketplace', 'infinite', filters],
    queryFn: ({ pageParam }) => coachesApi.list({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
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
