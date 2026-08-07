import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSeasonNoticeToast } from './useSeasonNotice';
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
  const notifySeason = useSeasonNoticeToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: trainingSessionsApi.create,
    onSuccess: created => {
      notifySeason(created);
      qc.invalidateQueries({ queryKey: ['trainingSessions'] });
    },
  });
}

export function useUpdateTrainingSession() {
  const notifySeason = useSeasonNoticeToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TrainingSession> }) =>
      trainingSessionsApi.update(id, data),
    onSuccess: updated => {
      notifySeason(updated);
      qc.invalidateQueries({ queryKey: ['trainingSessions'] });
    },
  });
}

export function useDeleteTrainingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: trainingSessionsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trainingSessions'] }),
  });
}
