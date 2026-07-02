import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recoveryApi, type ExerciseInput } from '../api/recoveryApi';

export function useInjuryRecoveryPlan(injuryId: number | null | undefined) {
  return useQuery({
    queryKey: ['recovery', 'injury', injuryId],
    queryFn: () => recoveryApi.getForInjury(injuryId!),
    enabled: !!injuryId,
  });
}

export function usePlayerRecoveryPlan(playerId: number | null | undefined) {
  return useQuery({
    queryKey: ['recovery', 'player', playerId],
    queryFn: () => recoveryApi.getForPlayer(playerId!),
    enabled: !!playerId,
  });
}

// Broad invalidation keeps every recovery view (injury, player) fresh after a mutation.
function useRecoveryMutation<TArgs>(fn: (a: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recovery'] }),
  });
}

export const useCreateRecoveryPlan = () =>
  useRecoveryMutation(({ injuryId, data }: { injuryId: number; data: { title: string; estimatedWeeks: number; notes?: string } }) => recoveryApi.create(injuryId, data));

export const useGenerateRecoveryPlan = () =>
  useRecoveryMutation((injuryId: number) => recoveryApi.generate(injuryId));

export const useUpdateRecoveryPlan = () =>
  useRecoveryMutation(({ planId, data }: { planId: number; data: { title: string; estimatedWeeks: number; currentWeek: number; status: string; notes?: string } }) => recoveryApi.updatePlan(planId, data));

export const useAddExercise = () =>
  useRecoveryMutation(({ planId, data }: { planId: number; data: ExerciseInput }) => recoveryApi.addExercise(planId, data));

export const useUpdateExercise = () =>
  useRecoveryMutation(({ exerciseId, data }: { exerciseId: number; data: ExerciseInput }) => recoveryApi.updateExercise(exerciseId, data));

export const useDeleteExercise = () =>
  useRecoveryMutation((exerciseId: number) => recoveryApi.deleteExercise(exerciseId));

export const useCompleteExercise = () =>
  useRecoveryMutation(({ exerciseId, data }: { exerciseId: number; data: { completedNote?: string; difficultyRating?: number } }) => recoveryApi.completeExercise(exerciseId, data));

export const useAddMilestone = () =>
  useRecoveryMutation(({ planId, data }: { planId: number; data: { title: string; targetWeek: number } }) => recoveryApi.addMilestone(planId, data));

export const useAchieveMilestone = () =>
  useRecoveryMutation((milestoneId: number) => recoveryApi.achieveMilestone(milestoneId));
