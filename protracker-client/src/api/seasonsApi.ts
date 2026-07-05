import api from './axiosInstance';
import type { Season, CreateSeasonInput, SeasonSummary } from '../types';

export const seasonsApi = {
  getForTeam: (teamId: number) =>
    api.get<Season[]>(`/api/teams/${teamId}/seasons`).then(r => r.data),
  getCurrent: (teamId: number) =>
    api.get<Season | null>(`/api/teams/${teamId}/seasons/current`).then(r => r.data),
  getActive: () =>
    api.get<Season[]>('/api/seasons/active').then(r => r.data),
  create: (teamId: number, data: CreateSeasonInput) =>
    api.post<Season>(`/api/teams/${teamId}/seasons`, data).then(r => r.data),
  update: (id: number, data: CreateSeasonInput) =>
    api.put<Season>(`/api/seasons/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/api/seasons/${id}`).then(r => r.data),
  getSummary: (id: number) =>
    api.get<SeasonSummary>(`/api/seasons/${id}/summary`).then(r => r.data),
  linkPeriod: (id: number, periodId: number) =>
    api.post(`/api/seasons/${id}/periods/${periodId}`).then(r => r.data),
  unlinkPeriod: (id: number, periodId: number) =>
    api.delete(`/api/seasons/${id}/periods/${periodId}`).then(r => r.data),
};
