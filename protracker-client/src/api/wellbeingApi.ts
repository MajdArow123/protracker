import api from './axiosInstance';
import type { WellbeingCheckin, PlayerWellbeingTrend, TeamWellbeingSummary } from '../types';

export interface SubmitCheckinInput {
  feeling: number;
  energy: number;
  sleep: number;
  hasPain: boolean;
  painArea?: string | null;
  painNote?: string | null;
  notes?: string | null;
}

export const wellbeingApi = {
  getMine: (days = 30) =>
    api.get<WellbeingCheckin[]>(`/api/wellbeing/mine?days=${days}`).then(r => r.data),
  getToday: () =>
    api.get<WellbeingCheckin | null>('/api/wellbeing/today').then(r => r.data),
  submit: (data: SubmitCheckinInput) =>
    api.post<WellbeingCheckin>('/api/wellbeing', data).then(r => r.data),
  getPlayerTrend: (playerId: number, days = 30) =>
    api.get<PlayerWellbeingTrend>(`/api/players/${playerId}/wellbeing?days=${days}`).then(r => r.data),
  getTeamSummary: () =>
    api.get<TeamWellbeingSummary>('/api/wellbeing/team-summary').then(r => r.data),
};
