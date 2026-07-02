import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wellbeingApi, type SubmitCheckinInput } from '../api/wellbeingApi';

export function useMyWellbeing(days = 30, enabled = true) {
  return useQuery({
    queryKey: ['wellbeing', 'mine', days],
    queryFn: () => wellbeingApi.getMine(days),
    enabled,
  });
}

export function useTodayCheckin(enabled = true) {
  return useQuery({
    queryKey: ['wellbeing', 'today'],
    queryFn: () => wellbeingApi.getToday(),
    enabled,
  });
}

export function useSubmitCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SubmitCheckinInput) => wellbeingApi.submit(data),
    onSuccess: (checkin) => {
      qc.setQueryData(['wellbeing', 'today'], checkin);
      qc.invalidateQueries({ queryKey: ['wellbeing', 'mine'] });
    },
  });
}

export function usePlayerWellbeing(playerId: number | null | undefined, days = 30, enabled = true) {
  return useQuery({
    queryKey: ['wellbeing', 'player', playerId, days],
    queryFn: () => wellbeingApi.getPlayerTrend(playerId!, days),
    enabled: !!playerId && enabled,
  });
}

export function useTeamWellbeing(enabled = true) {
  return useQuery({
    queryKey: ['wellbeing', 'teamSummary'],
    queryFn: () => wellbeingApi.getTeamSummary(),
    enabled,
    staleTime: 60_000,
  });
}
