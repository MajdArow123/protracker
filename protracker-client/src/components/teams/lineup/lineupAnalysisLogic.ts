import { compareByRating, type LineupPlayer } from './lineupLogic';
import { headToHead, type FitAssessment, type PickDetail } from './lineupFitLogic';
import type { Assignments } from './lineupEditLogic';
import type { FormationDef, FormationSlot } from './lineupFormations';

// Pure logic for Phase 5: squad analysis warnings + player comparison.
// Exported and unit-tested FIRST (src/test/lineupAnalysisLogic.test.ts).
//
// HONESTY CONTRACT (inherited from Phases 0-4, restated):
//   - Every warning is a claim about RECORDED or COACH-ENTERED facts, or about
//     the ABSENCE of data — never a quality verdict about a player.
//   - lowEvidenceStarters is a DATA claim ("thin or no evidence — ratings may
//     be unreliable"), never "these players are bad" (pinned by wording test).
//   - runnerUpNoEvidence reads as absence of information ("less is recorded
//     about X"), never as a quality verdict ("Y is better") — pinned.
//   - footMismatch fires ONLY on a coach-entered foot (null = no claim) and is
//     info-severity: a stated fact, not a judgement (inverted wingers exist).
//   - Warnings are DETERMINISTICALLY ordered (severity → code → first slot
//     key) so the panel never reshuffles between recomputes — pinned.
//   - The comparison recommendation is the UNCHANGED engine ordering
//     (compareByRating over primary-position-eligible candidates, headToHead
//     detail) — no new weighting, mirroring explainSuggestion's discipline.
//   - Co-appearance is a COUNT of shared rated matches, never a chemistry
//     score or link weight (the blueprint §4 honesty ceiling).

// ── Warning catalog ──────────────────────────────────────────────────────────

export type WarningSeverity = 'warning' | 'info';

export type WarningCode =
  | 'emptySlots'
  | 'injuredStarters'
  | 'oopStarters'
  | 'lowEvidenceStarters'
  | 'noBackupKeeper'
  | 'noBenchCover'
  | 'footMismatch'
  | 'captainNotSet';

/** Info rows are visually subordinate and sort after warnings (user ruling). */
export const WARNING_SEVERITY: Record<WarningCode, WarningSeverity> = {
  emptySlots: 'warning',
  injuredStarters: 'warning',
  oopStarters: 'warning',
  lowEvidenceStarters: 'warning',
  noBackupKeeper: 'warning',
  noBenchCover: 'warning',
  footMismatch: 'info',
  captainNotSet: 'info',
};

/** Fixed catalog order — the second key of the deterministic sort. */
export const CODE_ORDER: readonly WarningCode[] = [
  'emptySlots', 'injuredStarters', 'oopStarters', 'lowEvidenceStarters',
  'noBackupKeeper', 'noBenchCover', 'footMismatch', 'captainNotSet',
];

export interface SquadWarning {
  code: WarningCode;
  severity: WarningSeverity;
  /** Slots involved, in formation order (drives actions + the sort tiebreak). */
  slotKeys: string[];
  /** Players involved; index-aligned with slotKeys where both apply. */
  playerIds: number[];
  /** noBenchCover: the uncovered line's natural position ids (labelled via positionAbbr). */
  positionIds?: number[];
  /** footMismatch: the coach-entered foot and the slot side it opposes. */
  foot?: string;
  side?: 'left' | 'right';
}

/**
 * EN fallback messages — exported so tests can pin the wording discipline:
 * lowEvidenceStarters must read as a claim about DATA, never about quality.
 */
export const WARNING_EN: Record<WarningCode, string> = {
  emptySlots: 'Empty slots: {{slots}}',
  injuredStarters: 'Injured players in the XI: {{names}}',
  oopStarters: 'Out of position: {{names}}',
  lowEvidenceStarters: 'Thin or no evidence for: {{names}} — their ratings may be unreliable',
  noBackupKeeper: 'No goalkeeper cover on the bench',
  noBenchCover: 'No bench cover for: {{positions}}',
  footMismatch: '{{name}} is in a {{side}}-side slot — preferred foot {{foot}} (coach-entered)',
  captainNotSet: 'No captain set',
};

/**
 * EN fallback sentences for the head-to-head detail — shared by WhyPicksPanel
 * (Phase 4) and the Phase 5 comparison so both surfaces carry the SAME
 * discipline. runnerUpNoEvidence is ABSENCE-of-information framing ("less is
 * recorded about X"), never a quality verdict — pinned by test.
 */
export const PICK_DETAIL_EN: Record<PickDetail['kind'], string> = {
  higherValue: 'Selected over {{name}}: higher evidence ({{a}} vs {{b}})',
  confidenceTiebreak: 'Selected over {{name}}: equal rating ({{value}}) — higher confidence ({{a}} vs {{b}})',
  coverageTiebreak: 'Selected over {{name}}: equal rating — more scored metrics ({{a}} vs {{b}})',
  runnerUpNoEvidence: 'Selected while less is recorded about {{name}} — there was no evidence to compare',
  alphabetical: 'No evidence to compare with {{name}} — alphabetical order',
};

/**
 * Keeper-type positions per sport — drives noBackupKeeper and excludes the
 * keeper line from the generic cover sweep. Config, not inference: layout
 * flags can't distinguish a keeper (basketball marks every line
 * countsInShape:false). Sports without an entry never fire the warning.
 */
export const KEEPER_POSITION_IDS: Record<number, readonly number[]> = {
  1: [1], // soccer: Goalkeeper
};

/** Slot side from the fixed LTR surface geometry (same thresholds as slotSide). */
function sideOf(slot: FormationSlot): 'left' | 'right' | 'central' {
  if (slot.x <= 35) return 'left';
  if (slot.x >= 65) return 'right';
  return 'central';
}

export interface WarningsInput {
  sportId: number;
  formation: FormationDef;
  assignments: Assignments;
  /** Full roster (status + rating source). */
  players: readonly LineupPlayer[];
  /** Phase 4 fit matrix: playerId → slotKey → assessment. */
  fits: ReadonlyMap<number, ReadonlyMap<string, FitAssessment>>;
  injuredIds: ReadonlySet<number>;
  /** Coach-entered preferred foot by player id; missing/null = NO claim. */
  footById: ReadonlyMap<number, string | null | undefined>;
  /** Coach-entered secondary positions by player id (bench-cover counts them). */
  secondaryById: ReadonlyMap<number, readonly number[]>;
  /** Edit-mode-only nudges (captainNotSet) are suppressed in view mode. */
  editing: boolean;
  captainId: number | null;
}

export function buildWarnings(input: WarningsInput): SquadWarning[] {
  const {
    sportId, formation, assignments, players, fits, injuredIds,
    footById, secondaryById, editing, captainId,
  } = input;

  const byId = new Map(players.map(p => [p.id, p]));
  const xiIds = new Set(Object.values(assignments));
  const available = (p: LineupPlayer) => p.status !== 'Suspended' && p.status !== 'Inactive';
  const benchAvail = players.filter(p => !xiIds.has(p.id) && available(p));

  // Starters in formation-slot order — the deterministic base for every list.
  const starters = formation.slots
    .map(slot => ({ slot, player: assignments[slot.key] != null ? byId.get(assignments[slot.key]) : undefined }))
    .filter((s): s is { slot: FormationSlot; player: LineupPlayer } => s.player != null);

  const warnings: SquadWarning[] = [];
  const push = (w: Omit<SquadWarning, 'severity'>) =>
    warnings.push({ ...w, severity: WARNING_SEVERITY[w.code] });

  // emptySlots — one row listing every unfilled slot.
  const empty = formation.slots.filter(s => assignments[s.key] == null).map(s => s.key);
  if (empty.length > 0) push({ code: 'emptySlots', slotKeys: empty, playerIds: [] });

  // injuredStarters — recorded injuries on players in the XI.
  const injured = starters.filter(s => injuredIds.has(s.player.id));
  if (injured.length > 0) {
    push({ code: 'injuredStarters', slotKeys: injured.map(s => s.slot.key), playerIds: injured.map(s => s.player.id) });
  }

  // oopStarters — Phase 4 fit says outOfPosition. Secondary-position
  // placements are honest cover and NEVER warned (suppression pinned).
  const oop = starters.filter(s => fits.get(s.player.id)?.get(s.slot.key)?.category === 'outOfPosition');
  if (oop.length > 0) {
    push({ code: 'oopStarters', slotKeys: oop.map(s => s.slot.key), playerIds: oop.map(s => s.player.id) });
  }

  // lowEvidenceStarters — a DATA claim: thin or no evidence behind the rating.
  const lowEv = starters.filter(s => s.player.rating.kind === 'none' || s.player.rating.kind === 'thin');
  if (lowEv.length > 0) {
    push({ code: 'lowEvidenceStarters', slotKeys: lowEv.map(s => s.slot.key), playerIds: lowEv.map(s => s.player.id) });
  }

  // noBackupKeeper — config-driven; sports without a keeper concept never fire.
  const keeperIds = KEEPER_POSITION_IDS[sportId] ?? [];
  const isKeeperSlot = (slot: FormationSlot) => slot.naturalPositionIds.some(id => keeperIds.includes(id));
  const keeperSlots = formation.slots.filter(isKeeperSlot);
  if (keeperSlots.length > 0) {
    const covers = (p: LineupPlayer) =>
      (p.positionId != null && keeperIds.includes(p.positionId))
      || (secondaryById.get(p.id) ?? []).some(id => keeperIds.includes(id));
    if (!benchAvail.some(covers)) {
      push({ code: 'noBackupKeeper', slotKeys: keeperSlots.map(s => s.key), playerIds: [] });
    }
  }

  // noBenchCover — per formation line (keeper line excluded: it has its own,
  // sharper warning above). Coach-entered secondary positions count as cover.
  const lines = new Map<string, FormationSlot[]>();
  for (const slot of formation.slots) {
    if (isKeeperSlot(slot)) continue;
    const group = lines.get(slot.lineId) ?? [];
    group.push(slot);
    lines.set(slot.lineId, group);
  }
  for (const [, slots] of lines) {
    const union = [...new Set(slots.flatMap(s => s.naturalPositionIds))].sort((a, b) => a - b);
    const covered = benchAvail.some(p =>
      (p.positionId != null && union.includes(p.positionId))
      || (secondaryById.get(p.id) ?? []).some(id => union.includes(id)));
    if (!covered) {
      push({ code: 'noBenchCover', slotKeys: slots.map(s => s.key), playerIds: [], positionIds: union });
    }
  }

  // footMismatch (info, soccer only) — a stated coach-entered fact per slot.
  // 'Both' and null never fire; central slots make no side claim.
  if (sportId === 1) {
    for (const { slot, player } of starters) {
      const foot = footById.get(player.id);
      if (foot !== 'Left' && foot !== 'Right') continue;
      const side = sideOf(slot);
      if ((side === 'left' && foot === 'Right') || (side === 'right' && foot === 'Left')) {
        push({ code: 'footMismatch', slotKeys: [slot.key], playerIds: [player.id], foot, side });
      }
    }
  }

  // captainNotSet (info, edit mode only) — a coach-entered absence, nudged
  // only where it can be acted on.
  if (editing && captainId == null && starters.length > 0) {
    push({ code: 'captainNotSet', slotKeys: [], playerIds: [] });
  }

  // DETERMINISTIC ORDER (user ruling, pinned): severity → catalog code order →
  // first slot key. The panel must never reshuffle between recomputes.
  return warnings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'warning' ? -1 : 1;
    const codeDiff = CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code);
    if (codeDiff !== 0) return codeDiff;
    return (a.slotKeys[0] ?? '').localeCompare(b.slotKeys[0] ?? '');
  });
}

// ── Player comparison ────────────────────────────────────────────────────────

export interface SlotRecommendation {
  playerId: number;
  /** The best-rated OTHER eligible compared player, or null when uncontested. */
  runnerUpId: number | null;
  /** headToHead vs the runner-up — null when there is no runner-up. */
  detail: PickDetail | null;
  /** True when exactly one compared player is eligible for the slot. */
  onlyEligible: boolean;
}

/**
 * "Suggested for this slot" among the COMPARED players — the unchanged engine
 * discipline: primary-position eligibility (the engine never places by
 * secondary position, so the recommendation doesn't either), compareByRating
 * order, headToHead detail. No eligible candidate → null: NO suggestion is an
 * honest answer, never a fabricated one.
 */
export function recommendForSlot(
  candidates: readonly LineupPlayer[],
  slot: FormationSlot,
): SlotRecommendation | null {
  const eligible = candidates.filter(p =>
    p.status !== 'Suspended' && p.status !== 'Inactive'
    && p.positionId != null && slot.naturalPositionIds.includes(p.positionId));
  if (eligible.length === 0) return null;
  const sorted = [...eligible].sort(compareByRating);
  const [top, runnerUp] = sorted;
  return {
    playerId: top.id,
    runnerUpId: runnerUp?.id ?? null,
    detail: runnerUp ? headToHead(top, runnerUp) : null,
    onlyEligible: eligible.length === 1,
  };
}

/**
 * Shared rated-match COUNT for a pair of players — distinct matchResultIds
 * present in both rating lists. A count of shared appearances is the honesty
 * ceiling (blueprint §4): it is never a chemistry score, weight, or link.
 */
export function coAppearanceCount(
  a: readonly { matchResultId: number }[],
  b: readonly { matchResultId: number }[],
): number {
  const inA = new Set(a.map(r => r.matchResultId));
  const shared = new Set<number>();
  for (const r of b) {
    if (inA.has(r.matchResultId)) shared.add(r.matchResultId);
  }
  return shared.size;
}
