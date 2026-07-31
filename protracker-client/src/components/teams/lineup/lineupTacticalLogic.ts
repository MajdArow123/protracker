import type { LineupDto, SaveLineupInput, SetPieceDto } from '../../../api/lineupApi';
import type { Assignments } from './lineupEditLogic';
import type { FormationDef, FormationSlot } from './lineupFormations';

// Pure logic for the coach-authored tactical layer (Phase 3) — exported and
// unit-tested (src/test/lineupTacticalLogic.test.ts).
//
// Invariants mirrored from the server (LineupService.UpsertAsync):
//   captain/vice/takers ∈ XI, captain ≠ vice. `pruneTactical` maintains them
//   on every draft mutation so an invalid state is unrepresentable; the
//   server re-validates anyway.
//
// WRITE-THROUGH CONTRACT: server saves replace ALL tactical state (no merge).
// `buildSaveInput` therefore always emits every tactical field — captain,
// vice, notes, labels, set pieces, per-slot roles — whether set or empty.
// This is the only sanctioned way to build a save payload.

export interface TacticalState {
  captainId: number | null;
  viceCaptainId: number | null;
  notes: string;
  /** Selected tactical label keys (tacticalCatalog), order preserved. */
  labels: string[];
  /** slotKey → role key. Only OCCUPIED slots may carry a role (a role rides its slot row on save). */
  roles: Record<string, string>;
  /** set-piece type key → taker playerId. */
  setPieces: Record<string, number>;
}

export function emptyTactical(): TacticalState {
  return { captainId: null, viceCaptainId: null, notes: '', labels: [], roles: {}, setPieces: {} };
}

// ── Hydration (saved lineup → draft state, against the LIVE roster) ──────────

/**
 * Roster-keyed drop, mirroring `hydrateAssignments`: a saved captain/vice/taker
 * who is no longer on the roster (deleted or transferred) drops to empty —
 * never a ghost id. Roles survive only on slot keys the formation knows AND
 * whose player survived hydration (`assignments` is the already-hydrated set).
 */
export function hydrateTactical(
  saved: Partial<Pick<LineupDto, 'captainPlayerId' | 'viceCaptainPlayerId' | 'notes' | 'tacticalLabels' | 'slots' | 'setPieces'>>,
  assignments: Assignments,
  rosterIds: ReadonlySet<number>,
): TacticalState {
  const xi = new Set(Object.values(assignments));
  const keep = (id: number | null | undefined) => (id != null && rosterIds.has(id) && xi.has(id) ? id : null);

  // Wire data is Partial by design: a response cached before the tactical
  // fields shipped (or mid-rolling-deploy) simply hydrates to empty — a
  // missing array must NEVER crash the board (found live: pre-Phase-3
  // response + [...undefined] took the whole lineup tab down).
  const roles: Record<string, string> = {};
  for (const slot of saved.slots ?? []) {
    if (slot.role && slot.slotKey in assignments) roles[slot.slotKey] = slot.role;
  }

  const setPieces: Record<string, number> = {};
  for (const sp of saved.setPieces ?? []) {
    if (rosterIds.has(sp.playerId) && xi.has(sp.playerId) && !(sp.type in setPieces)) {
      setPieces[sp.type] = sp.playerId;
    }
  }

  const captainId = keep(saved.captainPlayerId);
  let viceCaptainId = keep(saved.viceCaptainPlayerId);
  if (viceCaptainId != null && viceCaptainId === captainId) viceCaptainId = null; // corrupt data guard

  return {
    captainId,
    viceCaptainId,
    notes: saved.notes ?? '',
    labels: [...(saved.tacticalLabels ?? [])],
    roles,
    setPieces,
  };
}

// ── Pruning (keep tactical state consistent with the current XI) ─────────────

/**
 * Re-establish the invariants after ANY assignments/formation change: captain,
 * vice and takers must be in the current XI; roles only on occupied slots the
 * formation knows. Returns the same object when nothing changed (so reducer
 * no-op detection keeps working).
 */
export function pruneTactical(
  tactical: TacticalState,
  assignments: Assignments,
  knownSlotKeys: ReadonlySet<string>,
): TacticalState {
  const xi = new Set(Object.values(assignments));

  const captainId = tactical.captainId != null && xi.has(tactical.captainId) ? tactical.captainId : null;
  const viceCaptainId =
    tactical.viceCaptainId != null && xi.has(tactical.viceCaptainId) && tactical.viceCaptainId !== captainId
      ? tactical.viceCaptainId
      : null;

  const roles: Record<string, string> = {};
  for (const [key, role] of Object.entries(tactical.roles)) {
    if (knownSlotKeys.has(key) && key in assignments) roles[key] = role;
  }

  const setPieces: Record<string, number> = {};
  for (const [type, playerId] of Object.entries(tactical.setPieces)) {
    if (xi.has(playerId)) setPieces[type] = playerId;
  }

  const next: TacticalState = { ...tactical, captainId, viceCaptainId, roles, setPieces };
  return sameTactical(next, tactical) ? tactical : next;
}

// ── Equality (dirty tracking; composed into the reducer's no-op check) ───────

function sameRecord<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every(k => a[k] === b[k]);
}

export function sameTactical(a: TacticalState, b: TacticalState): boolean {
  return (
    a.captainId === b.captainId &&
    a.viceCaptainId === b.viceCaptainId &&
    a.notes === b.notes &&
    a.labels.length === b.labels.length &&
    a.labels.every((l, i) => l === b.labels[i]) &&
    sameRecord(a.roles, b.roles) &&
    sameRecord(a.setPieces, b.setPieces)
  );
}

// ── Save payload (THE write-through contract) ────────────────────────────────

/**
 * Build the complete PUT payload. Every tactical field is always present —
 * a value when set, an explicit null/empty when not — because the server
 * clears whatever is omitted. Asserted by lineupTacticalLogic.test.ts.
 *
 * Phase 6: the target carries `baseVersion` (REQUIRED — null only when
 * creating; the caller decides, the compiler enforces the decision).
 */
export interface SaveTarget {
  matchResultId: number | null;
  baseVersion: number | null;
}

export function buildSaveInput(
  target: SaveTarget,
  formationKey: string,
  assignments: Assignments,
  tactical: TacticalState,
): SaveLineupInput {
  const slots = Object.entries(assignments)
    .map(([slotKey, playerId]) => ({
      slotKey,
      playerId,
      role: tactical.roles[slotKey] ?? null,
      instructions: null, // column shipped; UI deferred — nothing to send yet
    }))
    .sort((a, b) => a.slotKey.localeCompare(b.slotKey));

  const setPieces: SetPieceDto[] = Object.entries(tactical.setPieces)
    .map(([type, playerId]) => ({ type, playerId }))
    .sort((a, b) => a.type.localeCompare(b.type));

  const trimmed = tactical.notes.trim();
  return {
    matchResultId: target.matchResultId,
    baseVersion: target.baseVersion,
    formation: formationKey,
    captainPlayerId: tactical.captainId,
    viceCaptainPlayerId: tactical.viceCaptainId,
    notes: trimmed.length > 0 ? trimmed : null,
    tacticalLabels: [...tactical.labels],
    slots,
    setPieces,
  };
}

/** True when the saved lineup carries ANY tactical data worth a view-mode section. */
export function hasTacticalContent(t: TacticalState): boolean {
  return (
    t.captainId != null ||
    t.viceCaptainId != null ||
    t.notes.trim().length > 0 ||
    t.labels.length > 0 ||
    Object.keys(t.roles).length > 0 ||
    Object.keys(t.setPieces).length > 0
  );
}

// ── Position fit (the sharper OOP hint) ──────────────────────────────────────

export type PositionFit = 'natural' | 'secondary' | 'oop';

/**
 * Coach-entered secondary positions sharpen the OOP hint: a slot that is
 * natural for a SECONDARY position reads "secondary", not the amber OOP.
 * Unknown position → 'natural' (no claim — never guess a mismatch).
 */
export function positionFit(
  slot: FormationSlot,
  primaryPositionId: number | null | undefined,
  secondaryPositionIds: readonly number[] | undefined,
): PositionFit {
  if (primaryPositionId == null) return 'natural';
  if (slot.naturalPositionIds.includes(primaryPositionId)) return 'natural';
  if ((secondaryPositionIds ?? []).some(id => slot.naturalPositionIds.includes(id))) return 'secondary';
  return 'oop';
}

/** Formation slot-key set, memo-friendly helper for pruneTactical callers. */
export function slotKeysOf(formation: FormationDef): Set<string> {
  return new Set(formation.slots.map(s => s.key));
}
