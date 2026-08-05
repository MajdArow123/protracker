import api from './axiosInstance';
import type { PagedResult, SeasonResolutionNotice } from '../types';

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
  seasonNotice?: SeasonResolutionNotice | null;
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
  /** Named team lineup key (Phase 6); null on default XI and match lineups. */
  name?: string | null;
}

/** One row of GET /api/teams/{id}/lineups — every saved lineup for the team. */
export interface LineupSummaryDto {
  id: number;
  matchResultId: number | null;
  name: string | null;
  formation: string;
  status: string;
  publishedAt: string | null;
  version: number;
  slotCount: number;
  updatedAt: string;
  updatedByName: string | null;
}

/** One read-only audit row: who / when / real-diff summary (backend English data). */
export interface LineupAuditEntryDto {
  id: number;
  lineupId: number | null;
  keyLabel: string;
  changedByName: string;
  action: string;
  version: number;
  summary: string;
  createdAt: string;
}

/** The (matchId, name) pair addressing one lineup key — at most ONE may be set. */
export interface LineupKeyParams {
  matchId?: number | null;
  name?: string | null;
}

function keyQuery({ matchId, name }: LineupKeyParams): string {
  if (matchId != null) return `?matchId=${matchId}`;
  if (name != null && name.trim().length > 0) return `?name=${encodeURIComponent(name.trim())}`;
  return '';
}

export const lineupApi = {
  // null = nothing saved for this key; the UI falls back to the suggested XI.
  get: (teamId: number, params: LineupKeyParams = {}) =>
    api.get<LineupDto | null>(`/api/teams/${teamId}/lineup${keyQuery(params)}`).then(r => r.data),

  list: (teamId: number) =>
    api.get<LineupSummaryDto[]>(`/api/teams/${teamId}/lineups`).then(r => r.data),

  save: (teamId: number, data: SaveLineupInput) =>
    api.put<LineupDto>(`/api/teams/${teamId}/lineup`, data).then(r => r.data),

  reset: (teamId: number, params: LineupKeyParams = {}) =>
    api.delete<void>(`/api/teams/${teamId}/lineup${keyQuery(params)}`).then(() => undefined),

  publish: (lineupId: number) =>
    api.post<LineupDto>(`/api/lineups/${lineupId}/publish`).then(r => r.data),

  unpublish: (lineupId: number) =>
    api.post<LineupDto>(`/api/lineups/${lineupId}/unpublish`).then(r => r.data),

  audit: (teamId: number, opts: { lineupId?: number | null; page?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.lineupId != null) params.set('lineupId', String(opts.lineupId));
    if (opts.page != null) params.set('page', String(opts.page));
    const qs = params.toString();
    return api
      .get<PagedResult<LineupAuditEntryDto>>(`/api/teams/${teamId}/lineup-audit${qs ? `?${qs}` : ''}`)
      .then(r => r.data);
  },
};

// ── Tactical presets (Phase 6) — formation + slot roles + labels ONLY ────────

export interface TacticalPresetDto {
  id: number;
  sportId: number;
  name: string;
  formation: string | null;
  roles: Record<string, string>;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveTacticalPresetInput {
  sportId: number;
  name: string;
  formation: string | null;
  roles: Record<string, string>;
  labels: string[];
}

export const tacticalPresetApi = {
  getMine: (sportId?: number | null) =>
    api.get<TacticalPresetDto[]>(`/api/tactical-presets${sportId ? `?sport=${sportId}` : ''}`).then(r => r.data),

  create: (data: SaveTacticalPresetInput) =>
    api.post<TacticalPresetDto>('/api/tactical-presets', data).then(r => r.data),

  update: (id: number, data: SaveTacticalPresetInput) =>
    api.put<TacticalPresetDto>(`/api/tactical-presets/${id}`, data).then(r => r.data),

  remove: (id: number) =>
    api.delete<void>(`/api/tactical-presets/${id}`).then(() => undefined),
};
