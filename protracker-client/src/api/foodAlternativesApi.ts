import api from './axiosInstance';
import type { FoodAlternative, EquivalentFood, PlannedMealItem } from '../types';

export const foodAlternativesApi = {
  getAll: () => api.get<FoodAlternative[]>('/api/food-alternatives').then(r => r.data),
  getByFood: (food: string) =>
    api.get<FoodAlternative[]>(`/api/food-alternatives/${encodeURIComponent(food)}`).then(r => r.data),
  // Portion-scaled swap suggestions for a specific meal item.
  getEquivalents: (item: PlannedMealItem) =>
    api
      .get<EquivalentFood[]>('/api/food-alternatives/equivalent', {
        params: {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
          exclude: item.foodName,
        },
      })
      .then(r => r.data),
};
