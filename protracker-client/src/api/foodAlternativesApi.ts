import api from './axiosInstance';
import type { FoodAlternative } from '../types';

export const foodAlternativesApi = {
  getAll: () => api.get<FoodAlternative[]>('/api/food-alternatives').then(r => r.data),
  getByFood: (food: string) =>
    api.get<FoodAlternative[]>(`/api/food-alternatives/${encodeURIComponent(food)}`).then(r => r.data),
};
