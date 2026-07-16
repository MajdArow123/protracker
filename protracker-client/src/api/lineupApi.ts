import api from './axiosInstance';

export interface LineupSlotDto {
  slotKey: string;
  playerId: number;
}

export interface LineupDto {
  id: number;
  teamId: number;
  matchResultId: number | null;
  formation: string;
  updatedAt: string;
  slots: LineupSlotDto[];
}

export interface SaveLineupInput {
  matchResultId?: number | null;
  formation: string;
  slots: LineupSlotDto[];
}

export const lineupApi = {
  // null = nothing saved for this key; the UI falls back to the suggested XI.
  get: (teamId: number, matchId?: number | null) =>
    api.get<LineupDto | null>(`/api/teams/${teamId}/lineup${matchId ? `?matchId=${matchId}` : ''}`).then(r => r.data),

  save: (teamId: number, data: SaveLineupInput) =>
    api.put<LineupDto>(`/api/teams/${teamId}/lineup`, data).then(r => r.data),

  reset: (teamId: number, matchId?: number | null) =>
    api.delete<void>(`/api/teams/${teamId}/lineup${matchId ? `?matchId=${matchId}` : ''}`).then(() => undefined),
};
