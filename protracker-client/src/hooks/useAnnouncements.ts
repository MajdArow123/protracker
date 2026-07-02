import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi, type CreateAnnouncementInput } from '../api/announcementsApi';

export function useTeamAnnouncements(teamId: number | null | undefined) {
  return useQuery({
    queryKey: ['announcements', 'team', teamId],
    queryFn: () => announcementsApi.getForTeam(teamId!),
    enabled: !!teamId,
  });
}

export function useMyAnnouncements(enabled = true) {
  return useQuery({
    queryKey: ['announcements', 'mine'],
    queryFn: () => announcementsApi.getMine(),
    enabled,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: number; data: CreateAnnouncementInput }) => announcementsApi.create(teamId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateAnnouncementInput }) => announcementsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => announcementsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}
