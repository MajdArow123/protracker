import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  goalsApi, type CreateGoalInput, type UpdateGoalInput, type LogProgressInput,
  type CreateGoalMilestoneInput,
} from '../api/goalsApi';

// Athlete/solo: my own goals (all, including private).
export function useMyGoals(enabled = true) {
  return useQuery({
    queryKey: ['goals', 'mine'],
    queryFn: goalsApi.getMine,
    enabled,
  });
}

// Coach (non-private) or owning athlete: a player's goals.
export function usePlayerGoals(playerId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['goals', 'player', playerId],
    queryFn: () => goalsApi.getForPlayer(playerId!),
    enabled: !!playerId && enabled,
  });
}

export function useGoalProgress(goalId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['goals', 'progress', goalId],
    queryFn: () => goalsApi.getProgress(goalId!),
    enabled: !!goalId && enabled,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGoalInput) => goalsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateGoalInput }) => goalsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => goalsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useAchieveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => goalsApi.achieve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useLogGoalProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: LogProgressInput }) => goalsApi.logProgress(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      qc.invalidateQueries({ queryKey: ['goals', 'progress', id] });
    },
  });
}

export function useAddMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateGoalMilestoneInput }) => goalsApi.addMilestone(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useAchieveMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mid }: { id: number; mid: number }) => goalsApi.achieveMilestone(id, mid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}
