import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicApi, type UpdatePublicProfileInput } from '../api/publicApi';

// The current athlete/solo athlete's own sharing settings.
export function usePublicProfileSettings(enabled = true) {
  return useQuery({
    queryKey: ['publicProfile', 'settings'],
    queryFn: publicApi.getSettings,
    enabled,
  });
}

export function useUpdatePublicProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePublicProfileInput) => publicApi.updateSettings(data),
    onSuccess: (res) => qc.setQueryData(['publicProfile', 'settings'], res),
  });
}

// The anonymous public view for a slug (used by the shareable /player/:slug page).
export function usePublicProfileView(slug: string | undefined) {
  return useQuery({
    queryKey: ['publicProfile', 'view', slug],
    queryFn: () => publicApi.getPublic(slug!),
    enabled: !!slug,
    retry: false,
  });
}
