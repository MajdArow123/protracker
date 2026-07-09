import api from './axiosInstance';
import type {
  LeagueSummary, LeagueDetail, LeagueMatch, LeagueTeamEntry, LeagueStanding,
  CreateLeagueInput, UpdateLeagueInput, CreateLeagueMatchInput, UpdateLeagueMatchScoreInput,
  LeagueListQuery,
} from '../types';

function buildQuery(q: LeagueListQuery): string {
  const p = new URLSearchParams();
  if (q.sport != null) p.set('sport', String(q.sport));
  if (q.status) p.set('status', q.status);
  if (q.type) p.set('type', q.type);
  if (q.search) p.set('search', q.search);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const leaguesApi = {
  list: (q: LeagueListQuery = {}) =>
    api.get<LeagueSummary[]>(`/api/leagues${buildQuery(q)}`).then(r => r.data),
  mine: () => api.get<LeagueSummary[]>('/api/leagues/mine').then(r => r.data),
  detail: (id: number) => api.get<LeagueDetail>(`/api/leagues/${id}`).then(r => r.data),
  create: (data: CreateLeagueInput) => api.post<LeagueDetail>('/api/leagues', data).then(r => r.data),
  update: (id: number, data: UpdateLeagueInput) => api.put<LeagueDetail>(`/api/leagues/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/leagues/${id}`),

  registerTeam: (id: number, teamId: number) =>
    api.post<LeagueTeamEntry>(`/api/leagues/${id}/teams`, { teamId }).then(r => r.data),
  approveTeam: (id: number, leagueTeamId: number) =>
    api.put<LeagueTeamEntry>(`/api/leagues/${id}/teams/${leagueTeamId}/approve`).then(r => r.data),
  rejectTeam: (id: number, leagueTeamId: number) =>
    api.put<LeagueTeamEntry>(`/api/leagues/${id}/teams/${leagueTeamId}/reject`).then(r => r.data),

  matches: (id: number) => api.get<LeagueMatch[]>(`/api/leagues/${id}/matches`).then(r => r.data),
  createMatch: (id: number, data: CreateLeagueMatchInput) =>
    api.post<LeagueMatch>(`/api/leagues/${id}/matches`, data).then(r => r.data),
  updateScore: (matchId: number, data: UpdateLeagueMatchScoreInput) =>
    api.put<LeagueMatch>(`/api/league-matches/${matchId}/score`, data).then(r => r.data),
  deleteMatch: (matchId: number) => api.delete(`/api/league-matches/${matchId}`),
  generateSchedule: (id: number) =>
    api.post<{ matchesCreated: number }>(`/api/leagues/${id}/generate-schedule`).then(r => r.data),

  standings: (id: number) => api.get<LeagueStanding[]>(`/api/leagues/${id}/standings`).then(r => r.data),
};
