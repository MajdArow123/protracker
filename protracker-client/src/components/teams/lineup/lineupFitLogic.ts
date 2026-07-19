import {
  assignToSlots, compareByRating, type AssignTraceEvent, type LineupPlayer,
} from './lineupLogic';
import { suggestionLayout, type Assignments } from './lineupEditLogic';
import { positionFit } from './lineupTacticalLogic';
import type { FormationDef, FormationSlot } from './lineupFormations';
import type { EvidenceConfidence, Player } from '../../../types';

// Pure logic for Phase 4: honest position fit + explained auto-build. Exported
// and unit-tested FIRST (src/test/lineupFitLogic.test.ts).
//
// HONEST INPUT INVENTORY (the closed set — nothing else may enter):
//   evidence FinalScore + confidence + scoredMetrics, primary position,
//   secondary positions, preferred foot, injury/status availability, and
//   fitnessLevel ONLY when set. Form, readiness, chemistry, familiarity and
//   minutes are not-tracked and appear NOWHERE here.
//
// POSITION FIT IS CATEGORICAL — never a percentage. Positions are categories
// and evidence is a 0-10 measure of a different claim; any blend fabricates
// precision. The evidence rating renders BESIDE fit (RatingChip, own ladder),
// never inside it. Fit is `calculated` and states its method in the UI badge.

// ── Position fit (extends the Phase 3 positionFit primitive) ─────────────────

export type FitCategory = 'natural' | 'secondary' | 'outOfPosition' | 'cantAssess';

export interface FitAssessment {
  category: FitCategory;
  /**
   * Supplementary STATED FACT (coach-entered), soccer wide slots only — never
   * changes the category. Null = not applicable or not set (no guess).
   */
  footFact: string | null;
}

/** Slot side from the fixed surface geometry (LTR diagram convention). */
export function slotSide(slot: FormationSlot): 'left' | 'right' | 'central' {
  if (slot.x <= 35) return 'left';
  if (slot.x >= 65) return 'right';
  return 'central';
}

/**
 * The displayed fit claim. Unlike the Phase 3 badge primitive (which returns
 * 'natural' for an unknown position to SUPPRESS hints — no claim), a displayed
 * assessment must say "can't assess" out loud.
 */
export function assessFit(
  slot: FormationSlot,
  player: Pick<Player, 'positionId' | 'secondaryPositionIds' | 'preferredFoot' | 'sportId'>,
): FitAssessment {
  if (player.positionId == null) return { category: 'cantAssess', footFact: null };
  const primitive = positionFit(slot, player.positionId, player.secondaryPositionIds);
  const category: FitCategory = primitive === 'oop' ? 'outOfPosition' : primitive;
  const footFact =
    player.sportId === 1 && player.preferredFoot && slotSide(slot) !== 'central'
      ? player.preferredFoot
      : null;
  return { category, footFact };
}

/** Memo-friendly per-player-per-slot matrix; recompute only on roster/formation change. */
export function fitMatrix(players: Player[], formation: FormationDef): Map<number, Map<string, FitAssessment>> {
  const matrix = new Map<number, Map<string, FitAssessment>>();
  for (const p of players) {
    const row = new Map<string, FitAssessment>();
    for (const slot of formation.slots) row.set(slot.key, assessFit(slot, p));
    matrix.set(p.id, row);
  }
  return matrix;
}

// ── Explained auto-build (explanations over the UNCHANGED engine) ────────────
//
// The engine stays suggestedAssignments → assignToSlots ordered by the
// approved value-first compareByRating (value primary; confidence breaks exact
// ties only; thin data visible, never demoted). No new weighting — this layer
// only reports what the engine did, via its trace.
//
// Reason-code separation (pinned by tests):
//   'selectedOver'    — ONLY a genuine head-to-head ordering decision: a
//                       benched eligible runner-up existed and compareByRating
//                       decided between them.
//   'rescued' /       — STRUCTURAL pass-3 displacements. Never phrased as a
//   'movedForRescue'    head-to-head win.
//   'onlyEligible'    — literally one eligible candidate existed.
//   'uncontested'     — others eligible, but all of them are also in the XI.
//   'noEligible'      — empty slot: left empty, never faked.

export type PickDetail =
  | { kind: 'higherValue'; a: number; b: number }
  | { kind: 'confidenceTiebreak'; value: number; a: EvidenceConfidence; b: EvidenceConfidence }
  | { kind: 'coverageTiebreak'; value: number; a: number; b: number }
  | { kind: 'runnerUpNoEvidence' }
  | { kind: 'alphabetical' };

export type PickReason =
  | { code: 'selectedOver'; overId: number; detail: PickDetail }
  | { code: 'onlyEligible' }
  | { code: 'uncontested' }
  | { code: 'rescued'; displacedId: number; displacedToSlot: string }
  | { code: 'movedForRescue'; rescuedId: number; rescuedSlot: string }
  | { code: 'noEligible' };

/** Honest caveats on the PICKED player — stated, never hidden. */
export type PickCaveat = 'thinData' | 'noEvidence' | 'injured' | 'fitnessNotRecorded';

export interface SlotExplanation {
  slotKey: string;
  playerId: number | null;
  reason: PickReason;
  caveats: PickCaveat[];
}

export interface SuggestionExplanation {
  /** Identical to suggestedAssignments(players, formation) — pinned by test. */
  assignments: Assignments;
  explanations: SlotExplanation[];
}

export interface ExplainContext {
  injuredIds: ReadonlySet<number>;
  /** Player ids whose fitnessLevel is null (the only fitness fact allowed here — ruling #3). */
  fitnessNullIds: ReadonlySet<number>;
}

/**
 * The genuine head-to-head detail between a picked player and an eligible
 * runner-up — mirrors compareByRating's actual order. Exported for Phase 5's
 * comparison recommendation, which must reuse THIS logic (no new weighting).
 */
export function headToHead(picked: LineupPlayer, runnerUp: LineupPlayer): PickDetail {
  const a = picked.rating;
  const b = runnerUp.rating;
  if (a.kind === 'none' || b.kind === 'none') {
    // compareByRating sorts no-evidence last; if the runner-up (or both) have
    // none, no value comparison honestly exists.
    return b.kind === 'none' && a.kind !== 'none' ? { kind: 'runnerUpNoEvidence' } : { kind: 'alphabetical' };
  }
  if (a.value !== b.value) return { kind: 'higherValue', a: a.value, b: b.value };
  if (a.confidence !== b.confidence) return { kind: 'confidenceTiebreak', value: a.value, a: a.confidence, b: b.confidence };
  if (a.scoredMetrics !== b.scoredMetrics) return { kind: 'coverageTiebreak', value: a.value, a: a.scoredMetrics, b: b.scoredMetrics };
  return { kind: 'alphabetical' };
}

export function explainSuggestion(
  players: LineupPlayer[],
  formation: FormationDef,
  ctx: ExplainContext,
): SuggestionExplanation {
  const trace: AssignTraceEvent[] = [];
  const { placed, bench } = assignToSlots(players, suggestionLayout(formation), trace);

  const assignments: Assignments = {};
  for (const p of placed) assignments[p.lineId] = p.player.id;
  const byId = new Map(players.map(p => [p.id, p]));

  const explanations: SlotExplanation[] = formation.slots.map(slot => {
    const playerId = assignments[slot.key] ?? null;
    if (playerId == null) {
      return { slotKey: slot.key, playerId: null, reason: { code: 'noEligible' as const }, caveats: [] };
    }
    const picked = byId.get(playerId)!;

    // Structural codes FIRST — a pass-3 displacement is never a head-to-head win.
    const rescuedHere = trace.find(
      (e): e is Extract<AssignTraceEvent, { pass: 3 }> =>
        e.pass === 3 && e.lineId === slot.key && e.playerId === playerId,
    );
    const movedHere = trace.find(
      (e): e is Extract<AssignTraceEvent, { pass: 3 }> =>
        e.pass === 3 && e.displacedToLineId === slot.key && e.displacedId === playerId,
    );

    let reason: PickReason;
    if (rescuedHere) {
      reason = { code: 'rescued', displacedId: rescuedHere.displacedId, displacedToSlot: rescuedHere.displacedToLineId };
    } else if (movedHere) {
      reason = { code: 'movedForRescue', rescuedId: movedHere.playerId, rescuedSlot: movedHere.lineId };
    } else {
      const eligible = players.filter(
        p => p.status !== 'Suspended' && p.status !== 'Inactive'
          && p.positionId != null && slot.naturalPositionIds.includes(p.positionId),
      );
      if (eligible.length === 1) {
        reason = { code: 'onlyEligible' };
      } else {
        const benchedEligible = bench
          .filter(b => b.positionId != null && slot.naturalPositionIds.includes(b.positionId))
          .sort(compareByRating);
        reason = benchedEligible.length === 0
          ? { code: 'uncontested' }
          : { code: 'selectedOver', overId: benchedEligible[0].id, detail: headToHead(picked, benchedEligible[0]) };
      }
    }

    const caveats: PickCaveat[] = [];
    if (picked.rating.kind === 'none') caveats.push('noEvidence');
    else if (picked.rating.kind === 'thin') caveats.push('thinData');
    if (ctx.injuredIds.has(playerId)) caveats.push('injured');
    if (ctx.fitnessNullIds.has(playerId)) caveats.push('fitnessNotRecorded');

    return { slotKey: slot.key, playerId, reason, caveats };
  });

  return { assignments, explanations };
}
