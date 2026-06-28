import api from './axiosInstance';

export const reportsApi = {
  getPlayerReport: async (playerId: number) => {
    const res = await api.get(`/api/reports/player/${playerId}`);
    return res.data;
  },
  getTeamReport: async (teamId: number) => {
    const res = await api.get(`/api/reports/team/${teamId}`);
    return res.data;
  },
};
