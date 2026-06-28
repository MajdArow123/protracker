import api from './axiosInstance';
import type { PlayerAssessment } from '../types';

export const assessmentsApi = {
  getPlayerAssessments: async (playerId: number): Promise<PlayerAssessment[]> => {
    const res = await api.get<PlayerAssessment[]>(
      `/api/player-assessments/player/${playerId}`
    );
    return res.data;
  },
  getAssessment: async (id: number): Promise<PlayerAssessment> => {
    const res = await api.get<PlayerAssessment>(`/api/player-assessments/${id}`);
    return res.data;
  },
  createAssessment: async (data: Partial<PlayerAssessment>): Promise<PlayerAssessment> => {
    const res = await api.post<PlayerAssessment>('/api/player-assessments', data);
    return res.data;
  },
};
