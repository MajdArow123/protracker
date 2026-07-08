import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentsApi } from '../api/assessmentsApi';

export function usePlayerAssessments(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['assessments', playerId],
    queryFn: () => assessmentsApi.getPlayerAssessments(playerId!),
    enabled: !!playerId,
  });
}

export function useBulkCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentsApi.bulkCreate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessments'] }),
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentsApi.createAssessment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessments'] }),
  });
}
