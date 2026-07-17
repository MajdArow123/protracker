import type { LineupPlayer, SportLineupLayout } from './lineupLogic';
import { assignToSlots } from './lineupLogic';
import type { FormationDef, FormationSlot } from './lineupFormations';

// Pure logic for lineup editing (Phase 2) — exported and unit-tested
// (src/test/lineupEditLogic.test.ts). Assignments are a plain record of
// slotKey → playerId; absence of a key means the slot is empty.

export type Assignments = Record<string, number>;

export interface SavedLineupLike {
  formation: string;
  slots: { slotKey: string; playerId: number }[];
}

// ── Suggestion (the Phase 1 auto-arrange, aimed at a formation's slots) ──────

/**
 * Auto-arrange players into a formation's slots by reusing the Phase 1 engine:
 * each slot becomes a single-capacity line keyed by the slot key, so ratings,
 * the confidence tiebreak and the rescue pass all apply unchanged.
 */
export function suggestedAssignments(players: LineupPlayer[], formation: FormationDef): Assignments {
  const layout: SportLineupLayout = {
    kind: 'pitch',
    capacity: formation.slots.length,
    aspect: '1 / 1', // unused here
    lines: formation.slots.map(s => ({
      id: s.key,
      positionIds: s.naturalPositionIds,
      min: 1,
      max: 1,
      y: s.y,
      x: s.x,
      countsInShape: false,
    })),
  };
  const { placed } = assignToSlots(players, layout);
  const assignments: Assignments = {};
  for (const p of placed) assignments[p.lineId] = p.player.id;
  return assignments;
}

// ── Hydration (saved lineup → editable state, against the LIVE roster) ───────

/**
 * Turn a saved lineup into assignments for its formation's slots. Drops
 * anything that no longer holds: players not on the CURRENT roster (deleted OR
 * transferred — a transfer leaves a valid-but-off-team row), unknown slot keys
 * (definition drift), and duplicate players (corrupt data). Empty slot, never
 * a ghost, never a crash.
 */
export function hydrateAssignments(
  saved: SavedLineupLike,
  formation: FormationDef,
  rosterIds: ReadonlySet<number>,
): Assignments {
  const knownKeys = new Set(formation.slots.map(s => s.key));
  const assignments: Assignments = {};
  const used = new Set<number>();
  for (const slot of saved.slots) {
    if (!knownKeys.has(slot.slotKey)) continue;
    if (!rosterIds.has(slot.playerId)) continue;
    if (used.has(slot.playerId)) continue;
    if (slot.slotKey in assignments) continue;
    assignments[slot.slotKey] = slot.playerId;
    used.add(slot.playerId);
  }
  return assignments;
}

// ── Editing moves ────────────────────────────────────────────────────────────

export type Selection =
  | { kind: 'slot'; key: string }
  | { kind: 'bench'; playerId: number };

/**
 * Apply a tap on `target` while `selection` is active. Covers all pairs:
 * slot↔slot (swap/move), slot↔bench (swap out/in), bench→slot (place, occupant
 * to bench). Selecting the same thing twice, or bench→bench, is a no-op —
 * callers treat those as reselection. Always returns a new object.
 */
export function moveOrSwap(assignments: Assignments, selection: Selection, target: Selection): Assignments {
  const next: Assignments = { ...assignments };

  if (selection.kind === 'slot' && target.kind === 'slot') {
    if (selection.key === target.key) return next;
    const a = next[selection.key];
    const b = next[target.key];
    if (a == null && b == null) return next;
    if (a != null) next[target.key] = a; else delete next[target.key];
    if (b != null) next[selection.key] = b; else delete next[selection.key];
    return next;
  }

  if (selection.kind === 'slot' && target.kind === 'bench') {
    // Swap the slot's occupant with the bench player (or just place the bench
    // player if the slot was empty).
    const occupant = next[selection.key];
    if (occupant === target.playerId) return next;
    next[selection.key] = target.playerId;
    // occupant (if any) simply drops to the bench — assignments only track slots.
    void occupant;
    return next;
  }

  if (selection.kind === 'bench' && target.kind === 'slot') {
    next[target.key] = selection.playerId;
    return next;
  }

  return next; // bench→bench: reselection, handled by the caller
}

/** Empty a slot (the "send to bench" action). */
export function clearSlot(assignments: Assignments, slotKey: string): Assignments {
  const next = { ...assignments };
  delete next[slotKey];
  return next;
}

// ── Formation change ─────────────────────────────────────────────────────────

/**
 * Re-slot assignments when the formation changes: players stay in their line
 * (GK stays GK, defenders stay defenders…) in slot order; a shrinking line
 * drops its overflow to the bench; a growing line leaves new slots empty.
 * Players in lines the new formation lacks fall to the bench.
 */
export function remapFormation(assignments: Assignments, from: FormationDef, to: FormationDef): Assignments {
  const byLine = new Map<string, number[]>();
  for (const slot of from.slots) {
    const playerId = assignments[slot.key];
    if (playerId == null) continue;
    const pool = byLine.get(slot.lineId);
    if (pool) pool.push(playerId); else byLine.set(slot.lineId, [playerId]);
  }

  const next: Assignments = {};
  for (const slot of to.slots) {
    const pool = byLine.get(slot.lineId);
    if (pool && pool.length > 0) next[slot.key] = pool.shift()!;
  }
  return next;
}

export interface FormationChangeSummary {
  /** Players still placed after the remap. */
  kept: number;
  /** Players the remap drops to the bench (shrinking/removed lines). */
  benched: number[];
}

/**
 * What applying `remapFormation(assignments, from, to)` would do — drives the
 * apply-summary toast and the a11y announcement. Pure preview: does not apply.
 */
export function formationChangeSummary(
  assignments: Assignments,
  from: FormationDef,
  to: FormationDef,
): FormationChangeSummary {
  const next = remapFormation(assignments, from, to);
  const after = new Set(Object.values(next));
  const benched = [...new Set(Object.values(assignments))].filter(id => !after.has(id));
  return { kept: after.size, benched };
}

// ── Save validation ──────────────────────────────────────────────────────────

/**
 * Guard before PUT. The UI makes these states hard to reach; the guard makes
 * them impossible to save. Returns error keys (i18n-ready), empty = valid.
 */
export function validateLineup(
  assignments: Assignments,
  formation: FormationDef,
  rosterIds: ReadonlySet<number>,
): string[] {
  const errors: string[] = [];
  const knownKeys = new Set(formation.slots.map(s => s.key));
  const players = Object.values(assignments);
  if (Object.keys(assignments).some(k => !knownKeys.has(k))) errors.push('unknownSlot');
  if (new Set(players).size !== players.length) errors.push('duplicatePlayer');
  if (players.some(id => !rosterIds.has(id))) errors.push('offRosterPlayer');
  return errors;
}

export function toSaveSlots(assignments: Assignments): { slotKey: string; playerId: number }[] {
  return Object.entries(assignments)
    .map(([slotKey, playerId]) => ({ slotKey, playerId }))
    .sort((a, b) => a.slotKey.localeCompare(b.slotKey));
}

/** Deep equality for dirty-state tracking. */
export function sameLineup(aFormation: string, a: Assignments, bFormation: string, b: Assignments): boolean {
  if (aFormation !== bFormation) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every(k => a[k] === b[k]);
}

/** Out-of-position hint: the placed player's position isn't natural for the slot. */
export function isOutOfPosition(slot: FormationSlot, positionId: number | null | undefined): boolean {
  if (positionId == null) return false;
  return !slot.naturalPositionIds.includes(positionId);
}
