import api from './axiosInstance';
import type { Sport, Position, StatCategory } from '../types';

export const sportsApi = {
  getSports: async (): Promise<Sport[]> => {
    const res = await api.get<Sport[]>('/api/sports');
    return res.data;
  },
  getPositions: async (sportId: number): Promise<Position[]> => {
    const res = await api.get<Position[]>(`/api/sports/${sportId}/positions`);
    return res.data;
  },
  getStatCategories: async (sportId: number): Promise<StatCategory[]> => {
    const res = await api.get<StatCategory[]>(`/api/sports/${sportId}/stat-categories`);
    return res.data;
  },
};
