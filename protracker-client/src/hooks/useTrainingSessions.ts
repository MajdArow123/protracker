import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingSessionsApi } from '../api/trainingSessionsApi';
import type { TrainingSession } from '../types';

export function useTrainingSessions(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['trainingSessions', playerId],
    queryFn: () => trainingSessionsApi.getForPlayer(playerId!),
    enabled: !!playerId,
  });
}

export function useCreateTrainingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: trainingSessionsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainingSessions'] }),
  });
}

export function useUpdateTrainingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TrainingSession> }) =>
      trainingSessionsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainingSessions'] }),
  });
}

export function useDeleteTrainingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: trainingSessionsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainingSessions'] }),
  });
}
