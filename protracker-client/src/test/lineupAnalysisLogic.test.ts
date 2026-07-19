import { describe, it, expect } from 'vitest';
import {
  buildWarnings, recommendForSlot, coAppearanceCount,
  WARNING_EN, PICK_DETAIL_EN, WARNING_SEVERITY, CODE_ORDER,
  type WarningsInput, type SquadWarning,
} from '../components/teams/lineup/lineupAnalysisLogic';
import { fitMatrix } from '../components/teams/lineup/lineupFitLogic';
import type { LineupPlayer, RatingState } from '../components/teams/lineup/lineupLogic';
import type { FormationDef, FormationSlot } from '../components/teams/lineup/lineupFormations';
import type { EvidenceConfidence, Player } from '../../src/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const rated = (value: number, confidence: EvidenceConfidence = 'High', scoredMetrics = 5): RatingState =>
  ({ kind: confidence === 'Low' || scoredMetrics < 3 ? 'thin' : confidence === 'Medium' ? 'medium' : 'confident', value, confidence, scoredMetrics });

const lp = (id: number, name: string, positionId: number | null, rating: RatingState = rated(7), status = 'Active'): LineupPlayer =>
  ({ id, name, positionId, status, rating });

const slot = (key: string, naturalPositionIds: number[], x = 50, lineId = key): FormationSlot =>
  ({ key, x, y: 50, naturalPositionIds, lineId });

const formation = (key: string, slots: FormationSlot[]): FormationDef => ({ key, slots });

const player = (id: number, positionId: number | null, over: Partial<Player> = {}): Player =>
  ({ id, fullName: `P${id}`, sportId: 1, positionId, secondaryPositionIds: [], ...over } as Player);

/** Minimal input builder — soccer by default, everything honest-empty. */
function input(over: Partial<WarningsInput> & Pick<WarningsInput, 'formation' | 'assignments' | 'players'>): WarningsInput {
  const roster = over.players;
  const fitPlayers = roster.map(p => player(p.id, p.positionId, {
    secondaryPositionIds: [...(over.secondaryById?.get(p.id) ?? [])],
  }));
  return {
    sportId: 1,
    fits: fitMatrix(fitPlayers, over.formation),
    injuredIds: new Set<number>(),
    footById: new Map(),
    secondaryById: new Map(),
    editing: false,
    captainId: null,
    ...over,
  };
}

const codes = (ws: SquadWarning[]) => ws.map(w => w.code);
const byCode = (ws: SquadWarning[], code: string) => ws.filter(w => w.code === code);

// A 2-slot soccer formation with a keeper and one defender slot; bench cover
// exists for both, so the "clean" baseline produces ZERO warnings.
const F = formation('T', [slot('GK', [1], 50, 'GK'), slot('D1', [2], 20, 'DEF')]);
const cleanRoster = [lp(1, 'Keeper', 1), lp(2, 'Def', 2), lp(3, 'Keeper B', 1), lp(4, 'Def B', 2)];
const cleanAssignments = { GK: 1, D1: 2 };

describe('buildWarnings — triggers and suppressions', () => {
  it('a fully covered, healthy, natural XI produces zero warnings', () => {
    expect(buildWarnings(input({ formation: F, assignments: cleanAssignments, players: cleanRoster }))).toEqual([]);
  });

  it('emptySlots lists every unfilled slot', () => {
    const ws = buildWarnings(input({ formation: F, assignments: { D1: 2 }, players: cleanRoster }));
    expect(byCode(ws, 'emptySlots')[0]).toMatchObject({ slotKeys: ['GK'], severity: 'warning' });
  });

  it('injuredStarters fires only for injured players in the XI', () => {
    const ws = buildWarnings(input({
      formation: F, assignments: cleanAssignments, players: cleanRoster,
      injuredIds: new Set([2, 3]), // 2 starts, 3 is benched
    }));
    expect(byCode(ws, 'injuredStarters')[0]).toMatchObject({ playerIds: [2], slotKeys: ['D1'] });
  });

  it('oopStarters fires on outOfPosition; a SECONDARY-position placement is suppressed', () => {
    const roster = [lp(1, 'Keeper', 1), lp(2, 'Def', 2), lp(3, 'Keeper B', 1), lp(5, 'Striker', 5)];
    // Striker (pos 5) in the D1 slot → OOP.
    const oop = buildWarnings(input({ formation: F, assignments: { GK: 1, D1: 5 }, players: roster }));
    expect(byCode(oop, 'oopStarters')[0]).toMatchObject({ playerIds: [5], slotKeys: ['D1'] });
    // Same placement with defender as a coach-entered SECONDARY position → no warning.
    const sec = buildWarnings(input({
      formation: F, assignments: { GK: 1, D1: 5 }, players: roster,
      secondaryById: new Map([[5, [2]]]),
    }));
    expect(byCode(sec, 'oopStarters')).toEqual([]);
  });

  it('lowEvidenceStarters fires for thin AND none, not for medium/confident', () => {
    const roster = [
      lp(1, 'Keeper', 1, rated(7, 'Medium')),
      lp(2, 'Def', 2, { kind: 'none' }),
      lp(3, 'Keeper B', 1), lp(4, 'Def B', 2, rated(8, 'Low')),
    ];
    const ws = buildWarnings(input({ formation: F, assignments: cleanAssignments, players: roster }));
    expect(byCode(ws, 'lowEvidenceStarters')[0]).toMatchObject({ playerIds: [2] });
    const ws2 = buildWarnings(input({ formation: F, assignments: { GK: 1, D1: 4 }, players: roster }));
    expect(byCode(ws2, 'lowEvidenceStarters')[0]).toMatchObject({ playerIds: [4] });
  });

  it('noBackupKeeper: no bench keeper cover; suppressed by a secondary-position keeper and on keeperless sports', () => {
    const noCover = [lp(1, 'Keeper', 1), lp(2, 'Def', 2), lp(4, 'Def B', 2)];
    const ws = buildWarnings(input({ formation: F, assignments: cleanAssignments, players: noCover }));
    expect(byCode(ws, 'noBackupKeeper')[0]).toMatchObject({ slotKeys: ['GK'] });
    // A bench player with keeper as coach-entered secondary position IS cover.
    const sec = buildWarnings(input({
      formation: F, assignments: cleanAssignments, players: noCover,
      secondaryById: new Map([[4, [1]]]),
    }));
    expect(byCode(sec, 'noBackupKeeper')).toEqual([]);
    // Basketball (sport 2) has no keeper concept — never fires, even with the same shape.
    const bball = buildWarnings(input({
      sportId: 2,
      formation: formation('B', [slot('PG', [6], 50, 'PG')]),
      assignments: { PG: 10 },
      players: [lp(10, 'Guard', 6)],
    }));
    expect(byCode(bball, 'noBackupKeeper')).toEqual([]);
  });

  it('noBenchCover: per uncovered line, keeper line excluded, secondary counts as cover', () => {
    // Bench has a keeper but NO defender cover → DEF line uncovered, GK covered.
    const roster = [lp(1, 'Keeper', 1), lp(2, 'Def', 2), lp(3, 'Keeper B', 1)];
    const ws = buildWarnings(input({ formation: F, assignments: cleanAssignments, players: roster }));
    expect(byCode(ws, 'noBenchCover')).toHaveLength(1);
    expect(byCode(ws, 'noBenchCover')[0]).toMatchObject({ slotKeys: ['D1'], positionIds: [2] });
    expect(byCode(ws, 'noBackupKeeper')).toEqual([]); // keeper IS covered — and never double-reported
    // A benched player with defense as secondary suppresses it.
    const sec = buildWarnings(input({
      formation: F, assignments: cleanAssignments, players: roster,
      secondaryById: new Map([[3, [2]]]),
    }));
    expect(byCode(sec, 'noBenchCover')).toEqual([]);
    // Suspended players are NOT cover.
    const susp = buildWarnings(input({
      formation: F, assignments: cleanAssignments,
      players: [...roster, lp(9, 'Susp Def', 2, rated(7), 'Suspended')],
    }));
    expect(byCode(susp, 'noBenchCover')).toHaveLength(1);
  });

  it('footMismatch: coach-entered foot opposing a wide slot side — info only, never on null/Both/central/non-soccer', () => {
    const wide = formation('W', [slot('GK', [1], 50, 'GK'), slot('D1', [2], 20, 'DEF'), slot('M1', [3], 50, 'MID')]);
    const roster = [lp(1, 'Keeper', 1), lp(2, 'Def', 2), lp(3, 'Mid', 3), lp(4, 'Def B', 2), lp(5, 'Keeper B', 1), lp(6, 'Mid B', 3)];
    const assignments = { GK: 1, D1: 2, M1: 3 };
    const fire = buildWarnings(input({
      formation: wide, assignments, players: roster,
      footById: new Map([[2, 'Right'], [3, 'Right']]), // D1 is a left-side slot; M1 is central
    }));
    expect(byCode(fire, 'footMismatch')).toHaveLength(1);
    expect(byCode(fire, 'footMismatch')[0]).toMatchObject({
      severity: 'info', playerIds: [2], slotKeys: ['D1'], foot: 'Right', side: 'left',
    });
    // Matching foot, Both, and null all stay silent.
    for (const foot of ['Left', 'Both', null]) {
      const ws = buildWarnings(input({
        formation: wide, assignments, players: roster,
        footById: new Map([[2, foot]]),
      }));
      expect(byCode(ws, 'footMismatch')).toEqual([]);
    }
    // Non-soccer sports make no foot claims.
    const ws = buildWarnings(input({
      sportId: 3, formation: wide, assignments, players: roster,
      footById: new Map([[2, 'Right']]),
    }));
    expect(byCode(ws, 'footMismatch')).toEqual([]);
  });

  it('captainNotSet: edit mode only, suppressed once a captain exists', () => {
    const base = { formation: F, assignments: cleanAssignments, players: cleanRoster };
    expect(byCode(buildWarnings(input({ ...base, editing: true })), 'captainNotSet')).toHaveLength(1);
    expect(byCode(buildWarnings(input({ ...base, editing: false })), 'captainNotSet')).toEqual([]);
    expect(byCode(buildWarnings(input({ ...base, editing: true, captainId: 1 })), 'captainNotSet')).toEqual([]);
  });
});

describe('buildWarnings — deterministic order (user ruling, pinned)', () => {
  // A scenario producing warnings of BOTH severities across several codes:
  // empty slot, injured starter, low-evidence starter, two uncovered lines,
  // a foot mismatch and the captain nudge.
  const F3 = formation('T', [
    slot('GK', [1], 50, 'GK'),
    slot('D1', [2], 20, 'DEF'), slot('D2', [2], 80, 'DEF'),
    slot('M1', [3], 50, 'MID'),
  ]);
  const roster = [
    lp(1, 'Keeper', 1),
    lp(2, 'Def L', 2), lp(3, 'Def R', 2, { kind: 'none' }),
  ];
  const mk = () => buildWarnings(input({
    formation: F3,
    assignments: { GK: 1, D1: 2, D2: 3 }, // M1 empty
    players: roster,
    injuredIds: new Set([2]),
    footById: new Map([[2, 'Right'], [3, 'Left']]), // both mismatched → two info rows
    editing: true,
  }));

  it('sorts severity → catalog code → first slot key, info rows last', () => {
    const ws = mk();
    expect(codes(ws)).toEqual([
      'emptySlots',           // warning
      'injuredStarters',      // warning
      'lowEvidenceStarters',  // warning
      'noBackupKeeper',       // warning (no bench at all)
      'noBenchCover',         // warning — DEF line (D1 first)
      'noBenchCover',         // warning — MID line (M1)
      'footMismatch',         // info — D1 before D2 (slot-key tiebreak)
      'footMismatch',         // info
      'captainNotSet',        // info
    ]);
    const mismatches = byCode(ws, 'footMismatch');
    expect(mismatches.map(w => w.slotKeys[0])).toEqual(['D1', 'D2']);
    const covers = byCode(ws, 'noBenchCover');
    expect(covers.map(w => w.slotKeys[0])).toEqual(['D1', 'M1']);
  });

  it('is stable across recomputes and independent of roster input order', () => {
    const a = mk();
    const b = mk();
    expect(b).toEqual(a);
    const shuffled = buildWarnings(input({
      formation: F3,
      assignments: { GK: 1, D1: 2, D2: 3 },
      players: [...roster].reverse(),
      injuredIds: new Set([2]),
      footById: new Map([[3, 'Left'], [2, 'Right']]),
      editing: true,
    }));
    expect(codes(shuffled)).toEqual(codes(a));
  });

  it('every info code is subordinate to every warning code by construction', () => {
    for (const code of CODE_ORDER) {
      expect(['warning', 'info']).toContain(WARNING_SEVERITY[code]);
    }
    expect(WARNING_SEVERITY.footMismatch).toBe('info');
    expect(WARNING_SEVERITY.captainNotSet).toBe('info');
  });
});

describe('wording pins — data claims and absence framing, never quality verdicts', () => {
  it('lowEvidenceStarters is a claim about DATA, not about the players', () => {
    const msg = WARNING_EN.lowEvidenceStarters;
    expect(msg).toMatch(/evidence/i);
    expect(msg).toMatch(/ratings may be unreliable/i);
    expect(msg).not.toMatch(/\b(bad|weak|worst|poor|worse|better|best)\b/i);
  });

  it('runnerUpNoEvidence reads as ABSENCE of information, never a quality verdict', () => {
    const msg = PICK_DETAIL_EN.runnerUpNoEvidence;
    expect(msg).toMatch(/less is recorded about/i);
    expect(msg).not.toMatch(/\b(better|worse|best|stronger|weaker|higher|lower)\b/i);
    // The genuine-comparison sentences MAY state measured superiority — the
    // distinction between the two framings is exactly what this test pins.
    expect(PICK_DETAIL_EN.higherValue).toMatch(/higher evidence/i);
  });

  it('the footMismatch note states the coach-entered provenance', () => {
    expect(WARNING_EN.footMismatch).toMatch(/coach-entered/i);
  });
});

describe('recommendForSlot — the unchanged engine discipline', () => {
  const D = slot('D1', [2], 20);

  it('recommendation order is exactly compareByRating; detail is the real head-to-head', () => {
    const r = recommendForSlot([lp(1, 'A', 2, rated(8)), lp(2, 'B', 2, rated(6.5))], D);
    expect(r).toMatchObject({
      playerId: 1, runnerUpId: 2, onlyEligible: false,
      detail: { kind: 'higherValue', a: 8, b: 6.5 },
    });
  });

  it('no eligible compared player → null (no suggestion is the honest answer)', () => {
    expect(recommendForSlot([lp(1, 'Striker', 5), lp(2, 'Mid', 3)], D)).toBeNull();
    expect(recommendForSlot([], D)).toBeNull();
  });

  it('eligibility is primary-position only (the engine never places by secondary) and skips unavailable players', () => {
    // Suspended defender is not eligible; the other player is a striker → null.
    expect(recommendForSlot([lp(1, 'Susp', 2, rated(9), 'Suspended'), lp(2, 'Striker', 5)], D)).toBeNull();
  });

  it('single eligible → onlyEligible with no fabricated comparison', () => {
    const r = recommendForSlot([lp(1, 'A', 2, rated(8)), lp(2, 'Striker', 5, rated(9))], D);
    expect(r).toMatchObject({ playerId: 1, runnerUpId: null, detail: null, onlyEligible: true });
  });

  it('runner-up without evidence → the absence-framed detail kind', () => {
    const r = recommendForSlot([lp(1, 'A', 2, rated(7)), lp(2, 'B', 2, { kind: 'none' })], D);
    expect(r?.detail).toEqual({ kind: 'runnerUpNoEvidence' });
  });
});

describe('coAppearanceCount — a labeled count, never a score', () => {
  const r = (ids: number[]) => ids.map(matchResultId => ({ matchResultId }));

  it('counts distinct shared matches', () => {
    expect(coAppearanceCount(r([1, 2, 3]), r([2, 3, 4]))).toBe(2);
  });

  it('zero overlap is 0 — a fact, not an error', () => {
    expect(coAppearanceCount(r([1]), r([2]))).toBe(0);
    expect(coAppearanceCount(r([]), r([]))).toBe(0);
  });

  it('duplicate rating rows for the same match count once', () => {
    expect(coAppearanceCount(r([5, 5]), r([5, 5, 5]))).toBe(1);
  });
});
