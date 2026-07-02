import api from './axiosInstance';
import type { MatchResult, PlayerMatchRating } from '../types';

export interface CreateMatchInput {
  opponentName: string;
  matchDate: string;
  homeScore: number;
  awayScore: number;
  isHome: boolean;
  venue?: string;
  competition?: string;
  notes?: string;
}

export interface RatingInput {
  playerId: number;
  rating: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  notes?: string;
}

export const matchesApi = {
  getForTeam: (teamId: number) =>
    api.get<MatchResult[]>(`/api/teams/${teamId}/matches`).then(r => r.data),
  create: (teamId: number, data: CreateMatchInput) =>
    api.post<MatchResult>(`/api/teams/${teamId}/matches`, data).then(r => r.data),
  update: (id: number, data: CreateMatchInput) =>
    api.put<MatchResult>(`/api/matches/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/matches/${id}`),
  saveRatings: (id: number, ratings: RatingInput[]) =>
    api.post<MatchResult>(`/api/matches/${id}/ratings`, { ratings }).then(r => r.data),
  getPlayerRatings: (playerId: number) =>
    api.get<PlayerMatchRating[]>(`/api/players/${playerId}/match-ratings`).then(r => r.data),
};
