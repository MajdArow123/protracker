import api from './axiosInstance';
import type { Season, CreateSeasonInput, SeasonSummary, SeasonStampedCounts } from '../types';
import { localDateString } from '../utils/localDate';

export const seasonsApi = {
  getForTeam: (teamId: number) =>
    api.get<Season[]>(`/api/teams/${teamId}/seasons`).then(r => r.data),
  // Account-level: every season the caller owns, all statuses (S5).
  getAll: () => api.get<Season[]>('/api/seasons').then(r => r.data),
  getStampedCounts: (id: number) =>
    api.get<SeasonStampedCounts>(`/api/seasons/${id}/stamped-counts`).then(r => r.data),
  // "Current" is relative to the USER'S local date (Phase 10 ruling) — the server's
  // UTC today is only a fallback for callers that omit the param.
  getCurrent: (teamId: number) =>
    api
      .get<Season | null>(`/api/teams/${teamId}/seasons/current`, {
        params: { date: localDateString() },
      })
      .then(r => r.data),
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
