import api from './axiosInstance';
import type { NutritionProfileItem, NutritionGuidance } from '../types';

export const nutritionApi = {
  getNutritionProfile: async (playerId: number): Promise<NutritionProfileItem[]> => {
    const res = await api.get<NutritionProfileItem[]>(
      `/api/nutrition-profile/player/${playerId}`
    );
    return res.data;
  },
  getNutritionGuidance: async (playerId: number): Promise<NutritionGuidance[]> => {
    const res = await api.get<NutritionGuidance[]>(
      `/api/nutrition-guidance/player/${playerId}`
    );
    return res.data;
  },
  createGuidance: async (data: Partial<NutritionGuidance>): Promise<NutritionGuidance> => {
    const res = await api.post<NutritionGuidance>('/api/nutrition-guidance', data);
    return res.data;
  },
  updateGuidance: async (
    id: number,
    data: Partial<NutritionGuidance>
  ): Promise<NutritionGuidance> => {
    const res = await api.put<NutritionGuidance>(`/api/nutrition-guidance/${id}`, data);
    return res.data;
  },
};
