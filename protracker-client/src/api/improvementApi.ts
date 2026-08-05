import api from './axiosInstance';
import type { ImprovementPlan } from '../types';
import { localDateString } from '../utils/localDate';

export const improvementApi = {
  getPlayerPlans: async (playerId: number): Promise<ImprovementPlan[]> => {
    const res = await api.get<ImprovementPlan[]>(
      `/api/improvement-plans/player/${playerId}`
    );
    return res.data;
  },
  createPlan: async (data: Partial<ImprovementPlan>): Promise<ImprovementPlan> => {
    // Local calendar date drives the plan's season stamp (S2.2 ruling).
    const res = await api.post<ImprovementPlan>('/api/improvement-plans', {
      ...data,
      localDate: localDateString(),
    });
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
