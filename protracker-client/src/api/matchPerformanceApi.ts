import api from './axiosInstance';
import type { MatchPerformance } from '../types';

export const matchPerformanceApi = {
  getForPlayer: (playerId: number) =>
    api.get<MatchPerformance[]>(`/api/match-performance/player/${playerId}`).then(r => r.data),
  create: (data: Omit<MatchPerformance, 'id'>) =>
    api.post<MatchPerformance>('/api/match-performance', data).then(r => r.data),
  update: (id: number, data: Partial<MatchPerformance>) =>
    api.put<MatchPerformance>(`/api/match-performance/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/match-performance/${id}`),
};
