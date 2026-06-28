import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentPeriodsApi } from '../api/assessmentPeriodsApi';

export function useAssessmentPeriods() {
  return useQuery({
    queryKey: ['assessmentPeriods'],
    queryFn: assessmentPeriodsApi.getAll,
    staleTime: 60_000,
  });
}

export function useCreateAssessmentPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentPeriodsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessmentPeriods'] }),
  });
}

export function useDeleteAssessmentPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assessmentPeriodsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessmentPeriods'] }),
  });
}
