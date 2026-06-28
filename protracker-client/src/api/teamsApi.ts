import api from './axiosInstance';
import type { Team } from '../types';

export const teamsApi = {
  getTeams: async (): Promise<Team[]> => {
    const res = await api.get<Team[]>('/api/teams');
    return res.data;
  },
  getTeam: async (id: number): Promise<Team> => {
    const res = await api.get<Team>(`/api/teams/${id}`);
    return res.data;
  },
  createTeam: async (data: Partial<Team>): Promise<Team> => {
    const res = await api.post<Team>('/api/teams', data);
    return res.data;
  },
  updateTeam: async (id: number, data: Partial<Team>): Promise<Team> => {
    const res = await api.put<Team>(`/api/teams/${id}`, data);
    return res.data;
  },
  deleteTeam: async (id: number): Promise<void> => {
    await api.delete(`/api/teams/${id}`);
  },
  getTeamPlayers: async (id: number): Promise<import('../types').Player[]> => {
    const res = await api.get<import('../types').Player[]>(`/api/teams/${id}/players`);
    return res.data;
  },
};
