import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { seasonsApi } from '../api/seasonsApi';
import type { Season, CreateSeasonInput, SeasonSummary } from '../types';

export function useSeasons(teamId: number | undefined) {
  return useQuery<Season[]>({
    queryKey: ['seasons', teamId],
    queryFn: () => seasonsApi.getForTeam(teamId!),
    enabled: !!teamId,
  });
}

export function useCurrentSeason(teamId: number | undefined) {
  return useQuery<Season | null>({
    queryKey: ['season-current', teamId],
    queryFn: () => seasonsApi.getCurrent(teamId!),
    enabled: !!teamId,
  });
}

export function useActiveSeasons(enabled = true) {
  return useQuery<Season[]>({
    queryKey: ['seasons-active'],
    queryFn: seasonsApi.getActive,
    enabled,
  });
}

export function useSeasonSummary(seasonId: number | undefined) {
  return useQuery<SeasonSummary>({
    queryKey: ['season-summary', seasonId],
    queryFn: () => seasonsApi.getSummary(seasonId!),
    enabled: !!seasonId,
  });
}

// Any season mutation can shift the active season / linked counts / summaries, so refresh broadly.
function useInvalidateSeasons(teamId: number | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['seasons', teamId] });
    qc.invalidateQueries({ queryKey: ['season-current', teamId] });
    qc.invalidateQueries({ queryKey: ['seasons-active'] });
    qc.invalidateQueries({ queryKey: ['season-summary'] });
    qc.invalidateQueries({ queryKey: ['assessmentPeriods'] });
  };
}

export function useCreateSeason(teamId: number) {
  const invalidate = useInvalidateSeasons(teamId);
  return useMutation({
    mutationFn: (data: CreateSeasonInput) => seasonsApi.create(teamId, data),
    onSuccess: invalidate,
  });
}

export function useUpdateSeason(teamId: number) {
  const invalidate = useInvalidateSeasons(teamId);
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateSeasonInput }) => seasonsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteSeason(teamId: number) {
  const invalidate = useInvalidateSeasons(teamId);
  return useMutation({
    mutationFn: (id: number) => seasonsApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useLinkPeriod(teamId: number) {
  const invalidate = useInvalidateSeasons(teamId);
  return useMutation({
    mutationFn: ({ seasonId, periodId, link }: { seasonId: number; periodId: number; link: boolean }) =>
      link ? seasonsApi.linkPeriod(seasonId, periodId) : seasonsApi.unlinkPeriod(seasonId, periodId),
    onSuccess: invalidate,
  });
}
