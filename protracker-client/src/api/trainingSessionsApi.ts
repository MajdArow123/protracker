import api from './axiosInstance';
import type { TrainingSession } from '../types';

export const trainingSessionsApi = {
  getForPlayer: (playerId: number) =>
    api.get<TrainingSession[]>(`/api/training-sessions/player/${playerId}`).then(r => r.data),
  create: (data: Omit<TrainingSession, 'id'>) =>
    api.post<TrainingSession>('/api/training-sessions', data).then(r => r.data),
  update: (id: number, data: Partial<TrainingSession>) =>
    api.put<TrainingSession>(`/api/training-sessions/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/training-sessions/${id}`),
};
