import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSeasonNoticeToast } from './useSeasonNotice';
import { assessmentsApi } from '../api/assessmentsApi';

export function usePlayerAssessments(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['assessments', playerId],
    queryFn: () => assessmentsApi.getPlayerAssessments(playerId!),
    enabled: !!playerId,
  });
}

export function useBulkCreateAssessment() {
  const notifySeason = useSeasonNoticeToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentsApi.bulkCreate,
    onSuccess: created => {
      // One toast is enough — every row shares the same period/date resolution.
      notifySeason(created.find(a => a.seasonNotice));
      qc.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
}

export function useCreateAssessment() {
  const notifySeason = useSeasonNoticeToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentsApi.createAssessment,
    onSuccess: created => {
      notifySeason(created);
      qc.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
}
