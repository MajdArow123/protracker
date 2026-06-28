import api from './axiosInstance';
import type { CoachDashboard, PlayerDashboard } from '../types';

export const dashboardApi = {
  getCoachDashboard: async (): Promise<CoachDashboard> => {
    const res = await api.get<CoachDashboard>('/api/dashboard/coach');
    return res.data;
  },
  getPlayerDashboard: async (playerId: number): Promise<PlayerDashboard> => {
    const res = await api.get<PlayerDashboard>(`/api/dashboard/player/${playerId}`);
    return res.data;
  },
};
