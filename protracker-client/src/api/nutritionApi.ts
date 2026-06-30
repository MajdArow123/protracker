import api from './axiosInstance';
import type { NutritionProfileItem, NutritionGuidance, WeeklyNutritionPlan, PlannedMealItem, SwapMealItemRequest } from '../types';

export const nutritionApi = {
  getNutritionProfile: (playerId: number) =>
    api.get<NutritionProfileItem[]>(`/api/nutrition-profile/player/${playerId}`).then(r => r.data),
  createProfileItem: (playerId: number, data: Omit<NutritionProfileItem, 'id' | 'playerId'>) =>
    api.post<NutritionProfileItem>(`/api/nutrition-profile/player/${playerId}`, data).then(r => r.data),
  updateProfileItem: (playerId: number, itemId: number, data: Omit<NutritionProfileItem, 'id' | 'playerId'>) =>
    api.put<NutritionProfileItem>(`/api/nutrition-profile/player/${playerId}/${itemId}`, data).then(r => r.data),
  deleteProfileItem: (playerId: number, itemId: number) =>
    api.delete(`/api/nutrition-profile/player/${playerId}/${itemId}`),

  getNutritionGuidance: (playerId: number) =>
    api.get<NutritionGuidance[]>(`/api/nutrition-guidance/player/${playerId}`).then(r => r.data),
  createGuidance: (data: Partial<NutritionGuidance>) =>
    api.post<NutritionGuidance>('/api/nutrition-guidance', data).then(r => r.data),
  updateGuidance: (id: number, data: Partial<NutritionGuidance>) =>
    api.put<NutritionGuidance>(`/api/nutrition-guidance/${id}`, data).then(r => r.data),

  getWeeklyNutritionPlan: (playerId: number) =>
    api.get<WeeklyNutritionPlan>(`/api/players/${playerId}/weekly-nutrition-plan`).then(r => r.data),
  generateWeeklyNutritionPlan: (playerId: number) =>
    api.post<WeeklyNutritionPlan>(`/api/ai/weekly-nutrition-plan/${playerId}`).then(r => r.data),
  swapMealItem: (mealItemId: number, data: SwapMealItemRequest) =>
    api.post<PlannedMealItem>(`/api/meal-items/${mealItemId}/swap`, data).then(r => r.data),
};
