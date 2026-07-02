import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, type CreateTaskInput, type CoachTaskFilters } from '../api/tasksApi';

export function useCoachTasks(filters?: CoachTaskFilters, enabled = true) {
  return useQuery({
    queryKey: ['tasks', 'coach', filters ?? {}],
    queryFn: () => tasksApi.getForCoach(filters),
    enabled,
  });
}

export function useMyTasks(enabled = true) {
  return useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn: tasksApi.getMine,
    enabled,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => tasksApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateTaskInput }) => tasksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tasksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completedNote }: { id: number; completedNote?: string }) =>
      tasksApi.complete(id, completedNote),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useIncompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tasksApi.incomplete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
