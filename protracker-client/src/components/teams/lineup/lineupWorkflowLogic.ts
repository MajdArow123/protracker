import type { Assignments } from './lineupEditLogic';
import { remapFormation } from './lineupEditLogic';
import type { TacticalState } from './lineupTacticalLogic';
import { pruneTactical } from './lineupTacticalLogic';
import type { FormationDef } from './lineupFormations';

// Pure logic for the Phase 6 lineup workflow (exported + vitest-tested BEFORE
// any UI): conflict classification, the typed lineup context, the published
// lock, the named-lineup cap, and the client-side preset apply-diff.
//
// Program contracts these functions carry (see CLAUDE.md "Phase 6 workflow
// contracts"):
// - Never a silent clobber: every 409 resolves through classifyConflict and a
//   dialog; a version conflict must name WHO edited and WHEN so "Overwrite" is
//   an informed act (pinned by test).
// - The context key mapping must be byte-identical to the pre-Phase-6
//   `lineupKey` for default and match lineups — the refactor may not move
//   anyone's cache (pinned by test).
// - Presets carry formation + slot roles + labels ONLY. Apply is replace-all
//   over exactly that domain, computed client-side, shown as a diff first, and
//   the diff is DERIVED FROM the apply result so they can never disagree.

// ── Conflict classification (save 409 → dialog) ──────────────────────────────

/** The fields of a refetched lineup the conflict dialog needs. */
export interface ConflictSource {
  status: string;
  version: number;
  updatedAt: string;
  updatedByName: string | null;
}

export type ConflictKind = 'published' | 'version' | 'deleted';

export interface ConflictInfo {
  kind: ConflictKind;
  /** Who last edited — REQUIRED context for an informed Overwrite (never blind). */
  editedByName: string | null;
  editedAt: string | null;
  currentVersion: number | null;
}

/**
 * Classify a save 409 from the refetched target row:
 *   row gone        → 'deleted'   (offer: save as new / discard)
 *   row Published   → 'published' (locked: unpublish to change)
 *   otherwise       → 'version'   (edited elsewhere: reload or overwrite)
 */
export function classifyConflict(refetched: ConflictSource | null): ConflictInfo {
  if (refetched == null) {
    return { kind: 'deleted', editedByName: null, editedAt: null, currentVersion: null };
  }
  return {
    kind: refetched.status === 'Published' ? 'published' : 'version',
    editedByName: refetched.updatedByName,
    editedAt: refetched.updatedAt,
    currentVersion: refetched.version,
  };
}

// ── Typed lineup context (default | named | match) ───────────────────────────

export type LineupContext =
  | { kind: 'default' }
  | { kind: 'named'; name: string }
  | { kind: 'match'; matchId: number };

/** The server key is case-insensitive; the cache key must be too. */
export function normalizeLineupName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * TanStack query key for a context. For default and match contexts this is
 * BYTE-IDENTICAL to the pre-Phase-6 `lineupKey` (['lineup', teamId,
 * matchId ?? 'default']) — pinned by test so the refactor moves no caches.
 * Named contexts get a new, collision-free namespace ('named:{normalized}' is
 * a string, a matchId is a number, 'default' contains no colon).
 */
export function contextKey(teamId: number, ctx: LineupContext): readonly [string, number, string | number] {
  switch (ctx.kind) {
    case 'default': return ['lineup', teamId, 'default'] as const;
    case 'match': return ['lineup', teamId, ctx.matchId] as const;
    case 'named': return ['lineup', teamId, `named:${normalizeLineupName(ctx.name)}`] as const;
  }
}

/** GET/DELETE query params for a context (null = omit the param). */
export function contextRequestParams(ctx: LineupContext): { matchId: number | null; name: string | null } {
  switch (ctx.kind) {
    case 'default': return { matchId: null, name: null };
    case 'match': return { matchId: ctx.matchId, name: null };
    case 'named': return { matchId: null, name: ctx.name.trim() };
  }
}

/** Save-payload key fields for a context (name null on default AND match — the two-key model). */
export function contextToSaveTarget(ctx: LineupContext): { matchResultId: number | null; name: string | null } {
  switch (ctx.kind) {
    case 'default': return { matchResultId: null, name: null };
    case 'match': return { matchResultId: ctx.matchId, name: null };
    case 'named': return { matchResultId: null, name: ctx.name.trim() };
  }
}

export function sameContext(a: LineupContext, b: LineupContext): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'match' && b.kind === 'match') return a.matchId === b.matchId;
  if (a.kind === 'named' && b.kind === 'named') return normalizeLineupName(a.name) === normalizeLineupName(b.name);
  return true;
}

// ── Published lock ───────────────────────────────────────────────────────────

/**
 * Locked iff the SAVED row says Published. Unsaved (null/undefined) and Draft
 * are editable; unknown future statuses stay editable here — the server is the
 * real gate and a stale attempt lands in the 409 flow, never a silent clobber.
 */
export function canEditLineup(status: string | null | undefined): boolean {
  return status !== 'Published';
}

// ── Published roster drift (Phase 7a) ────────────────────────────────────────

/** The player references a SAVED lineup row carries (wire shape of LineupDto). */
export interface SavedLineupRefs {
  slots: { slotKey: string; playerId: number }[];
  captainPlayerId: number | null;
  viceCaptainPlayerId: number | null;
  setPieces: { type: string; playerId: number }[];
}

/**
 * Players a saved lineup references that are no longer on the live roster
 * (departed/transferred — hydration silently drops them into empty slots).
 * For a PUBLISHED lineup that silence violates the "a published lineup never
 * silently changes" rule, so the UI must surface this as an explicit warning
 * ("review and republish") whenever it is non-empty. Deterministic: unique
 * ids, ascending. Hydration behavior itself is unchanged.
 */
export function publishedRosterDrift(
  saved: SavedLineupRefs,
  rosterIds: ReadonlySet<number>,
): number[] {
  const referenced = new Set<number>();
  for (const s of saved.slots) referenced.add(s.playerId);
  if (saved.captainPlayerId != null) referenced.add(saved.captainPlayerId);
  if (saved.viceCaptainPlayerId != null) referenced.add(saved.viceCaptainPlayerId);
  for (const sp of saved.setPieces) referenced.add(sp.playerId);
  return [...referenced].filter(id => !rosterIds.has(id)).sort((a, b) => a - b);
}

// ── Named-lineup cap ─────────────────────────────────────────────────────────

export const MAX_NAMED_LINEUPS = 10;

export interface LineupSummaryLike {
  matchResultId: number | null;
  name: string | null;
}

/** Counts NAMED TEAM lineups only (name set, no match — the two-key model). */
export function namedLineupCap(list: readonly LineupSummaryLike[]): { used: number; max: number; reached: boolean } {
  const used = list.filter(l => l.matchResultId == null && l.name != null).length;
  return { used, max: MAX_NAMED_LINEUPS, reached: used >= MAX_NAMED_LINEUPS };
}

// ── Tactical preset apply-diff (client-side, per the approved design) ────────

/** What a preset stores — formation + slot roles + labels, NOTHING player-bound. */
export interface PresetContent {
  formation: string | null;
  roles: Record<string, string>;
  labels: string[];
}

export interface PresetApplyResult {
  formationKey: string;
  assignments: Assignments;
  tactical: TacticalState;
}

export interface DraftLike {
  formationKey: string;
  assignments: Assignments;
  tactical: TacticalState;
}

/**
 * Apply a preset to a draft — pure, replace-all over the preset's domain
 * (formation when set and known, ALL slot roles, ALL labels), verbatim
 * everything else. Invariants are re-established by the existing
 * `remapFormation` + `pruneTactical` (a formation shrink can bench the captain
 * — that consequence is real and therefore VISIBLE in the diff, never hidden).
 */
export function applyPresetToDraft(
  draft: DraftLike,
  preset: PresetContent,
  formations: readonly FormationDef[],
): PresetApplyResult {
  const from = formations.find(f => f.key === draft.formationKey);
  const to = preset.formation != null ? formations.find(f => f.key === preset.formation) : undefined;

  let formationKey = draft.formationKey;
  let assignments = draft.assignments;
  if (from && to && to.key !== from.key) {
    assignments = remapFormation(draft.assignments, from, to);
    formationKey = to.key;
  }

  const target = formations.find(f => f.key === formationKey);
  const knownSlotKeys = new Set((target?.slots ?? []).map(s => s.key));

  const replaced: TacticalState = {
    ...draft.tactical,
    labels: [...preset.labels],
    roles: { ...preset.roles },
  };
  return { formationKey, assignments, tactical: pruneTactical(replaced, assignments, knownSlotKeys) };
}

export type PresetDiffEntry =
  | { kind: 'formation'; from: string; to: string; benched: number[] }
  | { kind: 'roleSet'; slotKey: string; role: string }
  | { kind: 'roleChanged'; slotKey: string; from: string; to: string }
  | { kind: 'roleCleared'; slotKey: string; from: string }
  | { kind: 'labelAdded'; label: string }
  | { kind: 'labelRemoved'; label: string }
  | { kind: 'captainCleared'; playerId: number }
  | { kind: 'viceCaptainCleared'; playerId: number }
  | { kind: 'setPieceCleared'; type: string; playerId: number };

/**
 * The change list shown BEFORE applying — DERIVED from `applyPresetToDraft`'s
 * result (one source of truth: the diff can never disagree with what apply
 * does; pinned by test). Empty diff ⇒ apply is a no-op ⇒ the UI disables Apply.
 */
export function computePresetDiff(
  draft: DraftLike,
  preset: PresetContent,
  formations: readonly FormationDef[],
): PresetDiffEntry[] {
  const after = applyPresetToDraft(draft, preset, formations);
  const entries: PresetDiffEntry[] = [];

  if (after.formationKey !== draft.formationKey) {
    const before = new Set(Object.values(draft.assignments));
    const kept = new Set(Object.values(after.assignments));
    entries.push({
      kind: 'formation',
      from: draft.formationKey,
      to: after.formationKey,
      benched: [...before].filter(id => !kept.has(id)),
    });
  }

  const roleKeys = [...new Set([...Object.keys(draft.tactical.roles), ...Object.keys(after.tactical.roles)])].sort();
  for (const slotKey of roleKeys) {
    const from = draft.tactical.roles[slotKey];
    const to = after.tactical.roles[slotKey];
    if (from === to) continue;
    if (from == null) entries.push({ kind: 'roleSet', slotKey, role: to! });
    else if (to == null) entries.push({ kind: 'roleCleared', slotKey, from });
    else entries.push({ kind: 'roleChanged', slotKey, from, to });
  }

  const beforeLabels = new Set(draft.tactical.labels);
  const afterLabels = new Set(after.tactical.labels);
  for (const label of draft.tactical.labels) {
    if (!afterLabels.has(label)) entries.push({ kind: 'labelRemoved', label });
  }
  for (const label of after.tactical.labels) {
    if (!beforeLabels.has(label)) entries.push({ kind: 'labelAdded', label });
  }

  if (draft.tactical.captainId != null && after.tactical.captainId == null) {
    entries.push({ kind: 'captainCleared', playerId: draft.tactical.captainId });
  }
  if (draft.tactical.viceCaptainId != null && after.tactical.viceCaptainId == null) {
    entries.push({ kind: 'viceCaptainCleared', playerId: draft.tactical.viceCaptainId });
  }
  for (const [type, playerId] of Object.entries(draft.tactical.setPieces)) {
    if (after.tactical.setPieces[type] == null) entries.push({ kind: 'setPieceCleared', type, playerId });
  }

  return entries;
}
