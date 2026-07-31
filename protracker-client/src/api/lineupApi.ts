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
  /** Named team lineup (Phase 6); null on the default XI and on match lineups. */
  name: string | null;
  formation: string;
  /** Enum name: 'Draft' | 'Published'. Published = locked server-side (edit/delete 409). */
  status: string;
  publishedAt: string | null;
  /** Optimistic-concurrency version — echo as baseVersion on save. */
  version: number;
  updatedAt: string;
  /** Display name of the last editor; null if unknown. */
  updatedByName: string | null;
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
  /**
   * REQUIRED (Phase 6, never a silent clobber): null = "I'm creating this
   * lineup"; a number = "I'm updating THAT version". Stale, missing-on-existing
   * and set-against-a-deleted-row all 409 server-side; the conflict flow
   * (classifyConflict + dialog) resolves them — never silently.
   */
  baseVersion: number | null;
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
