import api from './axiosInstance';
import type { ScheduledSession, SessionType } from '../types';

export interface CreateSessionInput {
  title: string;
  sessionType: SessionType;
  startTime: string;
  // The user's LOCAL calendar date of startTime (yyyy-MM-dd) — drives season
  // resolution. Built from the datetime-local input's date part, NEVER from
  // toISOString() (S2.2 ruling: UTC conversion shifts evening users a day).
  localDate?: string;
  durationMinutes: number;
  location?: string;
  focus?: string;
  notes?: string;
}

export const sessionsApi = {
  getForTeam: (teamId: number) =>
    api.get<ScheduledSession[]>(`/api/teams/${teamId}/sessions`).then(r => r.data),
  getMine: () =>
    api.get<ScheduledSession[]>(`/api/sessions/mine`).then(r => r.data),
  create: (teamId: number, data: CreateSessionInput) =>
    api.post<ScheduledSession>(`/api/teams/${teamId}/sessions`, data).then(r => r.data),
  update: (id: number, data: CreateSessionInput) =>
    api.put<ScheduledSession>(`/api/sessions/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/sessions/${id}`),
};
