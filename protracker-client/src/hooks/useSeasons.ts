import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { seasonsApi } from '../api/seasonsApi';
import type {
  Season, CreateSeasonInput, SeasonSummary, SeasonRosterStint, SaveSeasonRosterStintInput,
} from '../types';

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

// Account-level list (S5): every season the caller owns, all statuses. Coach-only
// endpoint — gate with `enabled` on surfaces athletes can reach.
export function useAllSeasons(enabled = true) {
  return useQuery<Season[]>({
    queryKey: ['seasons-all'],
    queryFn: seasonsApi.getAll,
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

// Any season mutation can shift the active season / linked counts / summaries, so refresh
// broadly — the ['seasons'] root covers every per-team list.
function useInvalidateSeasons() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['seasons'] });
    qc.invalidateQueries({ queryKey: ['season-current'] });
    qc.invalidateQueries({ queryKey: ['seasons-active'] });
    qc.invalidateQueries({ queryKey: ['seasons-all'] });
    qc.invalidateQueries({ queryKey: ['season-summary'] });
    qc.invalidateQueries({ queryKey: ['assessmentPeriods'] });
  };
}

export function useCreateSeason() {
  const invalidate = useInvalidateSeasons();
  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: number; data: CreateSeasonInput }) => seasonsApi.create(teamId, data),
    onSuccess: invalidate,
  });
}

export function useUpdateSeason() {
  const invalidate = useInvalidateSeasons();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateSeasonInput }) => seasonsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteSeason() {
  const invalidate = useInvalidateSeasons();
  return useMutation({
    mutationFn: (id: number) => seasonsApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useLinkPeriod() {
  const invalidate = useInvalidateSeasons();
  return useMutation({
    mutationFn: ({ seasonId, periodId, link }: { seasonId: number; periodId: number; link: boolean }) =>
      link ? seasonsApi.linkPeriod(seasonId, periodId) : seasonsApi.unlinkPeriod(seasonId, periodId),
    onSuccess: invalidate,
  });
}

// ── S6 roster history ────────────────────────────────────────────────────────

export function useSeasonRoster(seasonId: number | undefined) {
  return useQuery<SeasonRosterStint[]>({
    queryKey: ['season-roster', seasonId],
    queryFn: () => seasonsApi.getRoster(seasonId!),
    enabled: !!seasonId,
  });
}

// Roster mutations touch only the roster list — stamps on existing records are
// deliberately NOT invalidated because saving a stint never changes them (ruling).
function useInvalidateSeasonRoster() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['season-roster'] });
}

export function useSaveStint() {
  const invalidate = useInvalidateSeasonRoster();
  return useMutation({
    mutationFn: ({ seasonId, stintId, data }: { seasonId: number; stintId?: number; data: SaveSeasonRosterStintInput }) =>
      stintId != null ? seasonsApi.updateStint(stintId, data) : seasonsApi.addStint(seasonId, data),
    onSuccess: invalidate,
  });
}

export function useDeleteStint() {
  const invalidate = useInvalidateSeasonRoster();
  return useMutation({
    mutationFn: (stintId: number) => seasonsApi.deleteStint(stintId),
    onSuccess: invalidate,
  });
}
