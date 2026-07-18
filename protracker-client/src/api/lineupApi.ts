import api from './axiosInstance';

export interface LineupSlotDto {
  slotKey: string;
  playerId: number;
  /** Per-sport preset role key (tacticalCatalog) — opaque to the server. */
  role?: string | null;
  /** Coach metadata; column shipped in Phase 3, UI deferred. */
  instructions?: string | null;
}

export interface SetPieceDto {
  /** Opaque sport-aware taker key (tacticalCatalog), like slotKey. */
  type: string;
  playerId: number;
}

export interface LineupDto {
  id: number;
  teamId: number;
  matchResultId: number | null;
  formation: string;
  updatedAt: string;
  captainPlayerId: number | null;
  viceCaptainPlayerId: number | null;
  notes: string | null;
  tacticalLabels: string[];
  slots: LineupSlotDto[];
  setPieces: SetPieceDto[];
}

// Saves are FULL WRITE-THROUGH on the server (no merge): omitting a tactical
// field clears it. Every tactical field is therefore REQUIRED here so the
// compiler rejects partial payloads — always build this via buildSaveInput
// (lineupTacticalLogic), never by hand.
export interface SaveLineupInput {
  matchResultId?: number | null;
  formation: string;
  captainPlayerId: number | null;
  viceCaptainPlayerId: number | null;
  notes: string | null;
  tacticalLabels: string[];
  slots: LineupSlotDto[];
  setPieces: SetPieceDto[];
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
