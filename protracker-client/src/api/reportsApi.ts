import api from './axiosInstance';

export const reportsApi = {
  // seasonId (S4, opt-in): scopes the report to rows STAMPED to that season; omitted =
  // career-wide (unchanged default).
  getPlayerReport: async (playerId: number, seasonId?: number) => {
    const res = await api.get(`/api/reports/player/${playerId}`, { params: { seasonId } });
    return res.data;
  },
  getTeamReport: async (teamId: number, seasonId?: number) => {
    const res = await api.get(`/api/reports/team/${teamId}`, { params: { seasonId } });
    return res.data;
  },
};
