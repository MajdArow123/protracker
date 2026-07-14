import { describe, it, expect } from 'vitest';
import {
  computeOverallRating, categoryBreakdown, compareByRating, assignToSlots, deriveFormation, buildLadder,
  type LineupPlayer, type RatingState,
} from '../components/teams/lineup/lineupLogic';
import {
  SOCCER_LAYOUT, BASKETBALL_LAYOUT, VOLLEYBALL_LAYOUT, BEACH_LAYOUT, TENNIS_LAYOUT, layoutForSport,
} from '../components/teams/lineup/lineupLayouts';
import type { EvidenceBasedScore, EvidenceConfidence, MetricCategory } from '../types';

// computeOverallRating reads finalScore, confidence, metricCategory, assessmentId.
function score(
  finalScore: number,
  confidence: EvidenceConfidence,
  category: MetricCategory = 'Physical',
  assessmentId: number | null = null,
): EvidenceBasedScore {
  return {
    id: 1, playerId: 1, metricDefinitionId: 1, metricName: 'M', metricCategory: category,
    sportStatCategoryId: null, assessmentId, finalScore, confidence, calculationMethod: 'Calculated',
    objectiveScore: null, matchStatScore: null, coachEvalScore: null, selfAssessScore: null,
    objectiveWeight: 0, matchStatWeight: 0, coachEvalWeight: 0, selfAssessWeight: 0,
    evidenceSources: [], explanation: null, missingEvidence: [], lastCalculatedAt: '2026-01-01T00:00:00Z',
    isObjectiveTestable: true, isObjectiveTestExpired: false, daysSinceObjectiveTest: null, nextObjectiveTestDue: null,
  };
}

function player(id: number, positionId: number | null, rating: RatingState, status = 'Active', name?: string): LineupPlayer {
  return { id, name: name ?? `Player ${id}`, positionId, status, rating };
}

const confident = (value: number, scoredMetrics = 5): RatingState =>
  ({ kind: 'confident', value, confidence: 'High', scoredMetrics });

describe('computeOverallRating — honesty gates', () => {
  it('zero scores → kind none, never a numeric 0.0', () => {
    const r = computeOverallRating([]);
    expect(r).toEqual({ kind: 'none' });
    expect('value' in r).toBe(false);
  });

  it('ignores assessment snapshot rows — only current (assessmentId null) rows count', () => {
    expect(computeOverallRating([score(8, 'High', 'Physical', 42)])).toEqual({ kind: 'none' });
  });

  it('fewer than 3 scored metrics is thin even at VeryHigh confidence', () => {
    const r = computeOverallRating([score(9, 'VeryHigh'), score(8, 'VeryHigh')]);
    expect(r.kind).toBe('thin');
  });

  it('Low overall confidence is thin even with broad coverage', () => {
    const r = computeOverallRating([score(7, 'Low'), score(7, 'Low'), score(7, 'Low'), score(7, 'Low')]);
    expect(r.kind).toBe('thin');
  });

  it('3+ metrics at Medium → medium; at High/VeryHigh → confident; value is the mean to 0.1', () => {
    const med = computeOverallRating([score(6, 'Medium'), score(7, 'Medium'), score(8, 'Medium')]);
    expect(med).toEqual({ kind: 'medium', value: 7, confidence: 'Medium', scoredMetrics: 3 });

    const conf = computeOverallRating([score(6.5, 'High'), score(7.2, 'High'), score(8.1, 'VeryHigh')]);
    expect(conf.kind).toBe('confident');
    expect(conf.kind !== 'none' && conf.value).toBe(7.3);
  });
});

describe('categoryBreakdown', () => {
  it('returns all 5 categories, null value where no data — never a fabricated number', () => {
    const stats = categoryBreakdown([score(8, 'High', 'Physical'), score(6, 'Medium', 'Physical'), score(9, 'High', 'Technical')]);
    expect(stats).toHaveLength(5);
    expect(stats.find(s => s.category === 'Physical')).toEqual({ category: 'Physical', value: 7, confidence: 'High' });
    expect(stats.find(s => s.category === 'Technical')?.value).toBe(9);
    expect(stats.find(s => s.category === 'Tactical')).toEqual({ category: 'Tactical', value: null, confidence: null });
  });
});

describe('compareByRating — confidence-aware tiebreak', () => {
  it('higher value wins regardless of confidence', () => {
    const a = player(1, 2, { kind: 'thin', value: 8, confidence: 'Low', scoredMetrics: 1 });
    const b = player(2, 2, confident(7));
    expect([b, a].sort(compareByRating)[0]).toBe(a);
  });

  it('equal value → higher confidence wins the contested slot', () => {
    const highConf = player(1, 2, { kind: 'confident', value: 7.5, confidence: 'VeryHigh', scoredMetrics: 5 });
    const lowConf = player(2, 2, { kind: 'thin', value: 7.5, confidence: 'Low', scoredMetrics: 5 });
    expect([lowConf, highConf].sort(compareByRating)[0]).toBe(highConf);
  });

  it('equal value + confidence → broader coverage wins, then name (deterministic)', () => {
    const broad = player(1, 2, { kind: 'confident', value: 7, confidence: 'High', scoredMetrics: 9 });
    const narrow = player(2, 2, { kind: 'confident', value: 7, confidence: 'High', scoredMetrics: 3 });
    expect([narrow, broad].sort(compareByRating)[0]).toBe(broad);

    const alpha = player(3, 2, confident(7), 'Active', 'Adams');
    const zeta = player(4, 2, confident(7), 'Active', 'Zimmer');
    expect([zeta, alpha].sort(compareByRating)[0]).toBe(alpha);
  });

  it('no-data players always sort last', () => {
    const none = player(1, 2, { kind: 'none' });
    const weak = player(2, 2, { kind: 'thin', value: 2.1, confidence: 'Low', scoredMetrics: 1 });
    expect([none, weak].sort(compareByRating)[0]).toBe(weak);
  });
});

describe('assignToSlots — soccer', () => {
  // 2 GK, 6 DEF, 5 MID, 3 WNG, 3 ST = 19 players, ratings descending by id.
  function fullSquad(): LineupPlayer[] {
    const roster: LineupPlayer[] = [];
    let id = 0;
    const add = (positionId: number, count: number) => {
      for (let i = 0; i < count; i++) roster.push(player(++id, positionId, confident(10 - id * 0.2)));
    };
    add(1, 2); add(2, 6); add(3, 5); add(4, 3); add(5, 3);
    return roster;
  }

  it('places exactly 11 with one GK; the rest go to the bench best-first', () => {
    const { placed, bench, excluded, unpositioned } = assignToSlots(fullSquad(), SOCCER_LAYOUT);
    expect(placed).toHaveLength(11);
    expect(placed.filter(p => p.lineId === 'GK')).toHaveLength(1);
    expect(bench).toHaveLength(8);
    expect(excluded).toHaveLength(0);
    expect(unpositioned).toHaveLength(0);
    // Bench is rating-sorted: the first bench player outrates the second.
    const v = (p: LineupPlayer) => (p.rating.kind === 'none' ? -1 : p.rating.value);
    expect(v(bench[0])).toBeGreaterThanOrEqual(v(bench[1]));
    // The placed GK is the better-rated of the two keepers (id 1).
    expect(placed.find(p => p.lineId === 'GK')!.player.id).toBe(1);
  });

  it('respects line min/max — never fewer than 3 DEF / 2 MID / 1 ATT, never more than max', () => {
    const { placed } = assignToSlots(fullSquad(), SOCCER_LAYOUT);
    const count = (line: string) => placed.filter(p => p.lineId === line).length;
    expect(count('DEF')).toBeGreaterThanOrEqual(3);
    expect(count('DEF')).toBeLessThanOrEqual(5);
    expect(count('MID')).toBeGreaterThanOrEqual(2);
    expect(count('MID')).toBeLessThanOrEqual(5);
    expect(count('ATT')).toBeGreaterThanOrEqual(1);
    expect(count('ATT')).toBeLessThanOrEqual(4);
  });

  it('a contested slot goes to the higher rating, then higher confidence at a tie', () => {
    // 5 strikers for 4 ATT slots; three outrank the tie, so the two 7.5s
    // contest the final slot and confidence must decide it.
    const squad: LineupPlayer[] = [
      player(1, 1, confident(6)),
      player(2, 2, confident(6)), player(3, 2, confident(6)), player(4, 2, confident(6)),
      player(5, 3, confident(6)), player(6, 3, confident(6)),
      player(10, 5, confident(9)), player(11, 5, confident(8.5)), player(14, 5, confident(8)),
      player(12, 5, { kind: 'confident', value: 7.5, confidence: 'VeryHigh', scoredMetrics: 6 }),
      player(13, 5, { kind: 'thin', value: 7.5, confidence: 'Low', scoredMetrics: 2 }),
    ];
    const { placed, bench } = assignToSlots(squad, SOCCER_LAYOUT);
    const attIds = placed.filter(p => p.lineId === 'ATT').map(p => p.player.id);
    expect(attIds).toHaveLength(4);
    expect(attIds).toContain(12); // VeryHigh 7.5 in
    expect(attIds).not.toContain(13); // Low 7.5 out — confidence-aware tiebreak
    expect(bench.map(p => p.id)).toContain(13);
  });

  it('no goalkeeper → the GK slot stays empty and only 10 outfielders are drawn', () => {
    const squad = fullSquad().filter(p => p.positionId !== 1);
    const { placed } = assignToSlots(squad, SOCCER_LAYOUT);
    expect(placed).toHaveLength(10);
    expect(placed.filter(p => p.lineId === 'GK')).toHaveLength(0);
  });

  it('Suspended/Inactive players are never placed; unknown positions land in the tray', () => {
    const squad = fullSquad();
    squad[2] = { ...squad[2], status: 'Suspended' };
    squad[3] = { ...squad[3], status: 'Inactive' };
    const stray = player(99, 999, confident(9.9)); // position id outside the sport's map
    const { placed, excluded, unpositioned } = assignToSlots([...squad, stray], SOCCER_LAYOUT);
    expect(placed.some(p => p.player.status !== 'Active')).toBe(false);
    expect(excluded.map(p => p.id).sort()).toEqual([squad[2].id, squad[3].id].sort());
    expect(unpositioned.map(p => p.id)).toEqual([99]);
    expect(placed.some(p => p.player.id === 99)).toBe(false);
  });

  it('small or empty rosters never break — draws what exists', () => {
    expect(assignToSlots([], SOCCER_LAYOUT).placed).toHaveLength(0);
    const seven = [
      player(1, 1, confident(7)), player(2, 2, confident(7)), player(3, 2, confident(7)),
      player(4, 3, confident(7)), player(5, 3, confident(7)), player(6, 4, confident(7)), player(7, 5, confident(7)),
    ];
    const { placed, bench } = assignToSlots(seven, SOCCER_LAYOUT);
    expect(placed).toHaveLength(7);
    expect(bench).toHaveLength(0);
  });

  it('x coordinates spread a line evenly and stay within the surface', () => {
    const { placed } = assignToSlots(fullSquad(), SOCCER_LAYOUT);
    for (const p of placed) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(100);
    }
    const def = placed.filter(p => p.lineId === 'DEF').map(p => p.x).sort((a, b) => a - b);
    const gaps = def.slice(1).map((x, i) => x - def[i]);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 5);
  });
});

describe('assignToSlots — basketball', () => {
  it('places one starter per position; a missing position leaves its slot empty (never faked)', () => {
    const squad = [
      player(1, 6, confident(7)), player(2, 6, confident(8)), // two PGs
      player(3, 7, confident(7)), player(4, 8, confident(7)), player(5, 9, confident(7)),
      // no Center on the roster
    ];
    const { placed, bench } = assignToSlots(squad, BASKETBALL_LAYOUT);
    expect(placed).toHaveLength(4);
    expect(placed.filter(p => p.lineId === 'C')).toHaveLength(0);
    // The better-rated PG starts; the other is benched.
    expect(placed.find(p => p.lineId === 'PG')!.player.id).toBe(2);
    expect(bench.map(p => p.id)).toEqual([1]);
  });

  it('single-slot lines use their configured court coordinates', () => {
    const squad = [player(1, 6, confident(7)), player(2, 10, confident(7))];
    const { placed } = assignToSlots(squad, BASKETBALL_LAYOUT);
    const pg = placed.find(p => p.lineId === 'PG')!;
    expect(pg.x).toBe(50);
    expect(pg.y).toBe(82);
  });
});

describe('assignToSlots — volleyball', () => {
  it('two Outside Hitters fill both OH slots, best in the front row; Libero slot is accented', () => {
    const squad = [
      player(1, 12, confident(9)), player(2, 12, confident(7)), player(3, 12, confident(6)),
      player(4, 14, confident(7)), player(5, 13, confident(7)),
      player(6, 15, confident(6)), player(7, 11, confident(7)),
    ];
    const { placed, bench } = assignToSlots(squad, VOLLEYBALL_LAYOUT);
    expect(placed).toHaveLength(6);
    expect(placed.find(p => p.lineId === 'OH_F')!.player.id).toBe(1); // best OH front
    expect(placed.find(p => p.lineId === 'OH_B')!.player.id).toBe(2); // second OH back
    expect(bench.map(p => p.id)).toEqual([3]); // third OH benched
    const libero = placed.find(p => p.lineId === 'L_B')!;
    expect(libero.player.id).toBe(6);
    expect(libero.accent).toBe(true);
  });

  it('no Libero on the roster → 5 on court, Libero slot empty', () => {
    const squad = [
      player(1, 12, confident(7)), player(2, 12, confident(7)),
      player(3, 14, confident(7)), player(4, 13, confident(7)), player(5, 11, confident(7)),
    ];
    const { placed } = assignToSlots(squad, VOLLEYBALL_LAYOUT);
    expect(placed).toHaveLength(5);
    expect(placed.filter(p => p.lineId === 'L_B')).toHaveLength(0);
  });
});

describe('assignToSlots — beach', () => {
  it('a Blocker + All-Round pair both get placed — the rescue pass shifts the flexible player over', () => {
    // The All-Round outrates the Blocker and takes BLK first; the stranded Blocker
    // (not eligible for DEF) is rescued by moving the All-Round to the open slot.
    const pair = assignToSlots([player(1, 17, confident(7)), player(2, 18, confident(8))], BEACH_LAYOUT);
    expect(pair.placed).toHaveLength(2);
    expect(pair.placed.find(p => p.lineId === 'BLK')!.player.id).toBe(1);
    expect(pair.placed.find(p => p.lineId === 'DEF')!.player.id).toBe(2);
    expect(pair.bench).toHaveLength(0);
  });

  it('with abundant candidates the two highest-rated players pair up — rating is never sacrificed', () => {
    // An 8.6 All-Round must not be benched in favor of a 6.7 specialist when both
    // slots can still be filled.
    const squad = [
      player(1, 17, confident(6.7)), // blocker
      player(2, 18, confident(8.6)), player(3, 18, confident(7.5)), // all-rounds
      player(4, 16, confident(7.4)), // defender
    ];
    const { placed, bench } = assignToSlots(squad, BEACH_LAYOUT);
    const placedIds = placed.map(p => p.player.id).sort();
    expect(placedIds).toEqual([2, 3]);
    expect(bench.map(p => p.id).sort()).toEqual([1, 4]);
  });

  it('two All-Rounds fill both slots by rating (net slot first)', () => {
    const pair = assignToSlots([player(1, 18, confident(6)), player(2, 18, confident(8))], BEACH_LAYOUT);
    expect(pair.placed.find(p => p.lineId === 'BLK')!.player.id).toBe(2);
    expect(pair.placed.find(p => p.lineId === 'DEF')!.player.id).toBe(1);
  });

  it('two Blockers → only one placed (the Defender slot is never faked)', () => {
    const { placed, bench } = assignToSlots([player(1, 17, confident(9)), player(2, 17, confident(8))], BEACH_LAYOUT);
    expect(placed).toHaveLength(1);
    expect(placed[0].lineId).toBe('BLK');
    expect(placed[0].player.id).toBe(1);
    expect(bench.map(p => p.id)).toEqual([2]);
  });
});

describe('buildLadder — tennis', () => {
  it('an unproven player can never rank, no matter how high the value', () => {
    const unproven = player(1, 19, { kind: 'thin', value: 9.9, confidence: 'VeryHigh', scoredMetrics: 2 });
    const proven = player(2, 21, confident(6.5));
    const { ranked, unranked } = buildLadder([unproven, proven]);
    expect(ranked.map(p => p.id)).toEqual([2]);
    expect(unranked.map(p => p.id)).toEqual([1]);
  });

  it('ranked is rating-sorted; a thin-but-covered player ranks (visible flag is the signal)', () => {
    const thinCovered = player(1, 19, { kind: 'thin', value: 8, confidence: 'Low', scoredMetrics: 5 }, 'Active', 'Thin');
    const solid = player(2, 21, confident(7), 'Active', 'Solid');
    const { ranked } = buildLadder([solid, thinCovered]);
    expect(ranked.map(p => p.id)).toEqual([1, 2]);
  });

  it('unranked is alphabetical (never ordered by unreliable values); excluded stay out', () => {
    const zed = player(1, 19, { kind: 'none' }, 'Active', 'Zed');
    const abe = player(2, 20, { kind: 'thin', value: 9, confidence: 'High', scoredMetrics: 1 }, 'Active', 'Abe');
    const out = player(3, 21, confident(9), 'Suspended');
    const { ranked, unranked, excluded } = buildLadder([zed, abe, out]);
    expect(ranked).toHaveLength(0);
    expect(unranked.map(p => p.id)).toEqual([2, 1]);
    expect(excluded.map(p => p.id)).toEqual([3]);
  });
});

describe('layoutForSport', () => {
  it('covers all five seeded sports — no coming-soon gaps', () => {
    for (const sportId of [1, 2, 3, 4, 5]) expect(layoutForSport(sportId)).not.toBeNull();
    expect(layoutForSport(99)).toBeNull();
    expect(layoutForSport(5)!.kind).toBe('ladder');
  });
});

describe('deriveFormation', () => {
  it('court sports derive no formation string — nothing worth claiming', () => {
    const squad = [
      player(1, 6, confident(7)), player(2, 7, confident(7)), player(3, 8, confident(7)),
      player(4, 9, confident(7)), player(5, 10, confident(7)),
    ];
    const arrangement = assignToSlots(squad, BASKETBALL_LAYOUT);
    expect(deriveFormation(arrangement.placed, BASKETBALL_LAYOUT)).toBeNull();
    expect(deriveFormation([], TENNIS_LAYOUT)).toBeNull();
  });

  it('returns DEF-MID-ATT counts of the drawn group, GK excluded', () => {
    const squad: LineupPlayer[] = [
      player(1, 1, confident(8)),
      player(2, 2, confident(8)), player(3, 2, confident(8)), player(4, 2, confident(8)), player(5, 2, confident(8)),
      player(6, 3, confident(8)), player(7, 3, confident(8)), player(8, 3, confident(8)),
      player(9, 4, confident(8)), player(10, 5, confident(8)), player(11, 4, confident(8)),
    ];
    const arrangement = assignToSlots(squad, SOCCER_LAYOUT);
    expect(deriveFormation(arrangement.placed, SOCCER_LAYOUT)).toBe('4-3-3');
  });

  it('returns null when fewer than 2 lines are populated — no fake formation claims', () => {
    const arrangement = assignToSlots([player(1, 1, confident(8)), player(2, 2, confident(8))], SOCCER_LAYOUT);
    expect(deriveFormation(arrangement.placed, SOCCER_LAYOUT)).toBeNull();
  });
});
