import { describe, it, expect } from 'vitest';
import {
  assessFit, slotSide, fitMatrix, explainSuggestion,
  type FitAssessment,
} from '../components/teams/lineup/lineupFitLogic';
import { suggestedAssignments, suggestionLayout } from '../components/teams/lineup/lineupEditLogic';
import { assignToSlots, type AssignTraceEvent, type LineupPlayer, type RatingState } from '../components/teams/lineup/lineupLogic';
import { formationOrDefault, type FormationDef, type FormationSlot } from '../components/teams/lineup/lineupFormations';
import type { EvidenceConfidence, Player } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const rated = (value: number, confidence: EvidenceConfidence = 'High', scoredMetrics = 5): RatingState =>
  ({ kind: confidence === 'Low' || scoredMetrics < 3 ? 'thin' : confidence === 'Medium' ? 'medium' : 'confident', value, confidence, scoredMetrics });

const lp = (id: number, name: string, positionId: number | null, rating: RatingState, status = 'Active'): LineupPlayer =>
  ({ id, name, positionId, status, rating });

const slot = (key: string, naturalPositionIds: number[], x = 50, y = 50): FormationSlot =>
  ({ key, x, y, naturalPositionIds, lineId: key });

const formation = (key: string, slots: FormationSlot[]): FormationDef =>
  ({ key, slots } as FormationDef);

const NO_CTX = { injuredIds: new Set<number>(), fitnessNullIds: new Set<number>() };

const reasonOf = (r: ReturnType<typeof explainSuggestion>, slotKey: string) =>
  r.explanations.find(e => e.slotKey === slotKey)!;

// ── Position fit (categorical, never a %) ────────────────────────────────────

describe('assessFit — categorical, explicit cant-assess, foot as stated fact only', () => {
  const wideLeft = slot('D1', [2], 20);
  const central = slot('M1', [3], 50);
  const player = (over: Partial<Player>): Player =>
    ({ id: 1, fullName: 'X', sportId: 1, positionId: 2, secondaryPositionIds: [], ...over } as Player);

  it('natural / secondary / outOfPosition / cantAssess', () => {
    expect(assessFit(wideLeft, player({})).category).toBe('natural');
    expect(assessFit(wideLeft, player({ positionId: 5, secondaryPositionIds: [2] })).category).toBe('secondary');
    expect(assessFit(wideLeft, player({ positionId: 5 })).category).toBe('outOfPosition');
    expect(assessFit(wideLeft, player({ positionId: null as never })).category).toBe('cantAssess');
  });

  it('the assessment never contains a number — no fabricated fit %', () => {
    const a: FitAssessment = assessFit(wideLeft, player({}));
    expect(Object.values(a).every(v => typeof v !== 'number')).toBe(true);
  });

  it('foot fact only on soccer wide slots, never changing the category', () => {
    expect(assessFit(wideLeft, player({ preferredFoot: 'Left' })).footFact).toBe('Left');
    expect(assessFit(central, player({ preferredFoot: 'Left' })).footFact).toBeNull();       // central
    expect(assessFit(wideLeft, player({ preferredFoot: 'Left', sportId: 2 })).footFact).toBeNull(); // not soccer
    expect(assessFit(wideLeft, player({})).footFact).toBeNull();                              // not set — no guess
    // out of position AND left-footed: category stays oop, foot is just a fact
    const oop = assessFit(wideLeft, player({ positionId: 5, preferredFoot: 'Left' }));
    expect(oop.category).toBe('outOfPosition');
    expect(oop.footFact).toBe('Left');
  });

  it('slotSide thresholds', () => {
    expect(slotSide(slot('a', [], 20))).toBe('left');
    expect(slotSide(slot('a', [], 35))).toBe('left');
    expect(slotSide(slot('a', [], 50))).toBe('central');
    expect(slotSide(slot('a', [], 65))).toBe('right');
  });

  it('fitMatrix covers every player × every slot', () => {
    const f = formation('T', [slot('S1', [2]), slot('S2', [3])]);
    const m = fitMatrix([player({ id: 1 }), player({ id: 2, positionId: 3 })], f);
    expect(m.size).toBe(2);
    expect([...m.get(1)!.keys()]).toEqual(['S1', 'S2']);
    expect(m.get(2)!.get('S2')!.category).toBe('natural');
  });
});

// ── Regression pin: the engine is UNCHANGED by Phase 4 ───────────────────────

describe('engine identity — explanations never change the arrangement', () => {
  const f433 = formationOrDefault(1, '4-3-3')!;
  const roster: LineupPlayer[] = [
    lp(1, 'Keeper A', 1, rated(7.0)), lp(2, 'Keeper B', 1, rated(6.0)),
    lp(3, 'Def A', 2, rated(8.0)), lp(4, 'Def B', 2, rated(7.5)),
    lp(5, 'Def C', 2, rated(7.0)), lp(6, 'Def D', 2, rated(6.5)), lp(7, 'Def E', 2, rated(6.0)),
    lp(8, 'Mid A', 3, rated(8.2)), lp(9, 'Mid B', 3, rated(7.1)), lp(10, 'Mid C', 3, rated(6.9)),
    lp(11, 'Wing A', 4, rated(7.7)), lp(12, 'Wing B', 4, rated(6.2)),
    lp(13, 'Striker A', 5, rated(8.9)), lp(14, 'Striker B', 5, rated(5.5)),
    lp(15, 'No Data', 2, { kind: 'none' }),
  ];

  it('explainSuggestion.assignments deep-equals suggestedAssignments', () => {
    expect(explainSuggestion(roster, f433, NO_CTX).assignments).toEqual(suggestedAssignments(roster, f433));
  });

  it('assignToSlots output is byte-identical with and without a trace', () => {
    const layout = suggestionLayout(f433);
    const trace: AssignTraceEvent[] = [];
    const a = assignToSlots(roster, layout);
    const b = assignToSlots(roster, layout, trace);
    expect(b.placed.map(p => [p.lineId, p.player.id])).toEqual(a.placed.map(p => [p.lineId, p.player.id]));
    expect(b.bench.map(p => p.id)).toEqual(a.bench.map(p => p.id));
    expect(trace.length).toBeGreaterThan(0);
  });

  it('hard-coded expectation on a deterministic fixture (engine drift guard)', () => {
    const f = formation('T', [slot('GK', [1]), slot('D1', [2]), slot('D2', [2]), slot('M1', [3])]);
    const players = [
      lp(1, 'GK', 1, rated(9)), lp(2, 'D-high', 2, rated(8)), lp(3, 'D-mid', 2, rated(7)),
      lp(4, 'D-low', 2, rated(6)), lp(5, 'M', 3, rated(5)),
    ];
    expect(suggestedAssignments(players, f)).toEqual({ GK: 1, D1: 2, D2: 3, M1: 5 });
    expect(explainSuggestion(players, f, NO_CTX).assignments).toEqual({ GK: 1, D1: 2, D2: 3, M1: 5 });
  });
});

// ── Reason codes: strict separation ──────────────────────────────────────────

describe('explainSuggestion — reason codes', () => {
  it('selectedOver fires ONLY on a genuine head-to-head (benched eligible runner-up)', () => {
    const f = formation('T', [slot('D1', [2])]);
    const r = explainSuggestion([lp(1, 'A', 2, rated(8)), lp(2, 'B', 2, rated(6))], f, NO_CTX);
    expect(reasonOf(r, 'D1').reason).toEqual({
      code: 'selectedOver', overId: 2, detail: { kind: 'higherValue', a: 8, b: 6 },
    });
  });

  it('equal values → the real confidence tiebreak; equal confidence → coverage', () => {
    const f = formation('T', [slot('D1', [2])]);
    const conf = explainSuggestion(
      [lp(1, 'A', 2, rated(7, 'High')), lp(2, 'B', 2, rated(7, 'Medium'))], f, NO_CTX);
    expect(reasonOf(conf, 'D1').reason).toMatchObject({
      code: 'selectedOver', detail: { kind: 'confidenceTiebreak', value: 7, a: 'High', b: 'Medium' },
    });
    const cov = explainSuggestion(
      [lp(1, 'A', 2, rated(7, 'High', 6)), lp(2, 'B', 2, rated(7, 'High', 4))], f, NO_CTX);
    expect(reasonOf(cov, 'D1').reason).toMatchObject({
      code: 'selectedOver', detail: { kind: 'coverageTiebreak', a: 6, b: 4 },
    });
  });

  it('runner-up without evidence is stated, not scored against', () => {
    const f = formation('T', [slot('D1', [2])]);
    const r = explainSuggestion([lp(1, 'A', 2, rated(7)), lp(2, 'B', 2, { kind: 'none' })], f, NO_CTX);
    expect(reasonOf(r, 'D1').reason).toMatchObject({
      code: 'selectedOver', overId: 2, detail: { kind: 'runnerUpNoEvidence' },
    });
  });

  it('both without evidence → alphabetical, never an invented comparison', () => {
    const f = formation('T', [slot('D1', [2])]);
    const r = explainSuggestion([lp(1, 'Aaron', 2, { kind: 'none' }), lp(2, 'Zed', 2, { kind: 'none' })], f, NO_CTX);
    expect(reasonOf(r, 'D1').reason).toMatchObject({
      code: 'selectedOver', detail: { kind: 'alphabetical' },
    });
    expect(reasonOf(r, 'D1').caveats).toContain('noEvidence');
  });

  it('STRUCTURAL SEPARATION: a pass-3 rescue is never phrased as selectedOver', () => {
    // S1 fits [1,2]; S2 fits only [2]. A (pos2, 9.0) takes S1 in pass 1; B
    // (pos1, 8.0) is stranded; pass 3 shifts A to S2 and seats B in S1.
    // C (pos1, 7.0) stays benched and IS an eligible runner-up for S1 — the
    // reason must still be the structural one, never a head-to-head claim.
    const f = formation('T', [slot('S1', [1, 2]), slot('S2', [2])]);
    const r = explainSuggestion(
      [lp(1, 'A-flex', 2, rated(9)), lp(2, 'B-spec', 1, rated(8)), lp(3, 'C-spec', 1, rated(7))],
      f, NO_CTX);
    expect(reasonOf(r, 'S1').reason).toEqual({ code: 'rescued', displacedId: 1, displacedToSlot: 'S2' });
    expect(reasonOf(r, 'S2').reason).toEqual({ code: 'movedForRescue', rescuedId: 2, rescuedSlot: 'S1' });
    expect(r.explanations.some(e => e.reason.code === 'selectedOver')).toBe(false);
  });

  it('onlyEligible when literally one candidate exists', () => {
    const f = formation('T', [slot('GK', [1]), slot('D1', [2])]);
    const r = explainSuggestion([lp(1, 'GK', 1, rated(6)), lp(2, 'D', 2, rated(7))], f, NO_CTX);
    expect(reasonOf(r, 'GK').reason).toEqual({ code: 'onlyEligible' });
  });

  it('uncontested when the other eligibles are all in the XI too', () => {
    const f = formation('T', [slot('D1', [2]), slot('D2', [2])]);
    const r = explainSuggestion([lp(1, 'A', 2, rated(8)), lp(2, 'B', 2, rated(7))], f, NO_CTX);
    expect(reasonOf(r, 'D1').reason).toEqual({ code: 'uncontested' });
    expect(reasonOf(r, 'D2').reason).toEqual({ code: 'uncontested' });
  });

  it('an empty slot says so — left empty, never faked', () => {
    const f = formation('T', [slot('GK', [1]), slot('D1', [2])]);
    const r = explainSuggestion([lp(2, 'D', 2, rated(7))], f, NO_CTX);
    expect(reasonOf(r, 'GK')).toEqual({ slotKey: 'GK', playerId: null, reason: { code: 'noEligible' }, caveats: [] });
  });
});

// ── Caveats: stated, never hidden ────────────────────────────────────────────

describe('explainSuggestion — honest caveats on the picked player', () => {
  const f = formation('T', [slot('D1', [2])]);

  it('thin data / injured / fitness-not-recorded are all stated', () => {
    const r = explainSuggestion(
      [lp(1, 'A', 2, rated(8, 'Low', 2))], f,
      { injuredIds: new Set([1]), fitnessNullIds: new Set([1]) });
    expect(reasonOf(r, 'D1').caveats).toEqual(['thinData', 'injured', 'fitnessNotRecorded']);
  });

  it('a SET fitness value produces NO caveat and never enters selection (ruling #3)', () => {
    const r = explainSuggestion([lp(1, 'A', 2, rated(8))], f, NO_CTX);
    expect(reasonOf(r, 'D1').caveats).toEqual([]);
  });
});
