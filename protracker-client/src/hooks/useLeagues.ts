import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaguesApi } from '../api/leaguesApi';
import type {
  LeagueListQuery, CreateLeagueInput, UpdateLeagueInput, CreateLeagueMatchInput,
  UpdateLeagueMatchScoreInput,
} from '../types';

export function useLeagues(q: LeagueListQuery = {}, enabled = true) {
  return useQuery({
    queryKey: ['leagues', 'browse', q],
    queryFn: () => leaguesApi.list(q),
    enabled,
  });
}

export function useMyLeagues(enabled = true) {
  return useQuery({
    queryKey: ['leagues', 'mine'],
    queryFn: () => leaguesApi.mine(),
    enabled,
  });
}

export function useLeague(id: number | undefined) {
  return useQuery({
    queryKey: ['leagues', 'detail', id],
    queryFn: () => leaguesApi.detail(id!),
    enabled: !!id,
  });
}

export function useLeagueMatches(id: number | undefined) {
  return useQuery({
    queryKey: ['leagues', 'matches', id],
    queryFn: () => leaguesApi.matches(id!),
    enabled: !!id,
  });
}

export function useCreateLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeagueInput) => leaguesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}

export function useUpdateLeague(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLeagueInput) => leaguesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}

export function useDeleteLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaguesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}

export function useRegisterLeagueTeam(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => leaguesApi.registerTeam(id, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}

export function useSetLeagueTeamStatus(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leagueTeamId, approve }: { leagueTeamId: number; approve: boolean }) =>
      approve ? leaguesApi.approveTeam(id, leagueTeamId) : leaguesApi.rejectTeam(id, leagueTeamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}

export function useCreateLeagueMatch(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeagueMatchInput) => leaguesApi.createMatch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}

// `id` kept in the signature for call-site symmetry; invalidation is league-wide.
export function useUpdateLeagueScore(_id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, data }: { matchId: number; data: UpdateLeagueMatchScoreInput }) =>
      leaguesApi.updateScore(matchId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}

export function useDeleteLeagueMatch(_id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: number) => leaguesApi.deleteMatch(matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}

export function useGenerateSchedule(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => leaguesApi.generateSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });
}
