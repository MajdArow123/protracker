import api from './axiosInstance';
import type { ImprovementPlan } from '../types';

export const improvementApi = {
  getPlayerPlans: async (playerId: number): Promise<ImprovementPlan[]> => {
    const res = await api.get<ImprovementPlan[]>(
      `/api/improvement-plans/player/${playerId}`
    );
    return res.data;
  },
  createPlan: async (data: Partial<ImprovementPlan>): Promise<ImprovementPlan> => {
    const res = await api.post<ImprovementPlan>('/api/improvement-plans', data);
    return res.data;
  },
  updatePlan: async (
    id: number,
    data: Partial<ImprovementPlan>
  ): Promise<ImprovementPlan> => {
    const res = await api.put<ImprovementPlan>(`/api/improvement-plans/${id}`, data);
    return res.data;
  },
};
