import api from './axiosInstance';
import type { PlayerTask, TaskPriority, TaskCategory } from '../types';

export interface CreateTaskInput {
  playerId: number;
  title: string;
  description?: string;
  dueDate?: string | null;
  priority: TaskPriority;
  category: TaskCategory;
}

export interface CoachTaskFilters {
  playerId?: number;
  completed?: boolean;
  priority?: TaskPriority;
}

export const tasksApi = {
  getForCoach: (filters?: CoachTaskFilters) => {
    const q = new URLSearchParams();
    if (filters?.playerId != null) q.set('playerId', String(filters.playerId));
    if (filters?.completed != null) q.set('completed', String(filters.completed));
    if (filters?.priority) q.set('priority', filters.priority);
    const qs = q.toString();
    return api.get<PlayerTask[]>(`/api/tasks${qs ? `?${qs}` : ''}`).then(r => r.data);
  },
  getMine: () => api.get<PlayerTask[]>('/api/tasks/mine').then(r => r.data),
  create: (data: CreateTaskInput) => api.post<PlayerTask>('/api/tasks', data).then(r => r.data),
  update: (id: number, data: CreateTaskInput) => api.put<PlayerTask>(`/api/tasks/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/tasks/${id}`),
  complete: (id: number, completedNote?: string) =>
    api.patch<PlayerTask>(`/api/tasks/${id}/complete`, { completedNote }).then(r => r.data),
  incomplete: (id: number) =>
    api.patch<PlayerTask>(`/api/tasks/${id}/incomplete`, {}).then(r => r.data),
};
