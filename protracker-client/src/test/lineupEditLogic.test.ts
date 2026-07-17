import { describe, it, expect } from 'vitest';
import {
  suggestedAssignments, hydrateAssignments, moveOrSwap, clearSlot, remapFormation,
  formationChangeSummary, validateLineup, toSaveSlots, sameLineup, isOutOfPosition,
  type Assignments,
} from '../components/teams/lineup/lineupEditLogic';
import { SOCCER_FORMATIONS, formationOrDefault, isEditableSport, defaultFormation } from '../components/teams/lineup/lineupFormations';
import type { LineupPlayer, RatingState } from '../components/teams/lineup/lineupLogic';

const F433 = SOCCER_FORMATIONS.find(f => f.key === '4-3-3')!;
const F442 = SOCCER_FORMATIONS.find(f => f.key === '4-4-2')!;
const F532 = SOCCER_FORMATIONS.find(f => f.key === '5-3-2')!;

const confident = (value: number): RatingState => ({ kind: 'confident', value, confidence: 'High', scoredMetrics: 5 });
const player = (id: number, positionId: number, value = 7, status = 'Active'): LineupPlayer =>
  ({ id, name: `P${id}`, positionId, status, rating: confident(value) });

describe('formation definitions', () => {
  it('every formation has 11 unique slot keys (soccer) and tennis is not editable', () => {
    for (const f of SOCCER_FORMATIONS) {
      expect(f.slots).toHaveLength(11);
      expect(new Set(f.slots.map(s => s.key)).size).toBe(11);
    }
    expect(isEditableSport(1)).toBe(true);
    expect(isEditableSport(5)).toBe(false);
    expect(defaultFormation(5)).toBeNull();
  });

  it('unknown stored formation keys fall back to the sport default', () => {
    expect(formationOrDefault(1, '9-9-9')!.key).toBe('4-3-3');
    expect(formationOrDefault(1, '3-5-2')!.key).toBe('3-5-2');
  });
});

describe('suggestedAssignments', () => {
  it('fills a 4-3-3 from a balanced roster, best-rated per slot, GK never outfield', () => {
    const roster = [
      player(1, 1, 6), player(2, 1, 8), // two GKs
      player(11, 2, 7), player(12, 2, 8), player(13, 2, 6), player(14, 2, 7.5), player(15, 2, 5),
      player(21, 3, 7), player(22, 3, 8), player(23, 3, 6),
      player(31, 4, 7), player(32, 5, 9), player(33, 5, 6),
    ];
    const a = suggestedAssignments(roster, F433);
    expect(a['GK']).toBe(2); // better keeper
    expect(Object.values(a)).toHaveLength(11);
    expect(Object.values(a)).not.toContain(1); // second keeper benched, never outfield
    expect(Object.values(a)).toContain(32); // best striker in
  });

  it('a roster with no goalkeeper leaves GK empty — never faked', () => {
    const roster = [player(11, 2), player(21, 3), player(31, 5)];
    const a = suggestedAssignments(roster, F433);
    expect(a['GK']).toBeUndefined();
    expect(Object.values(a)).toHaveLength(3);
  });
});

describe('hydrateAssignments — live-roster discipline', () => {
  const roster = new Set([1, 2, 3]);

  it('drops players no longer on the roster (deleted OR transferred) → empty slot, no ghost', () => {
    const a = hydrateAssignments(
      { formation: '4-3-3', slots: [{ slotKey: 'GK', playerId: 1 }, { slotKey: 'D1', playerId: 99 }] },
      F433, roster,
    );
    expect(a).toEqual({ GK: 1 });
  });

  it('drops unknown slot keys and duplicate players — corrupt data never crashes', () => {
    const a = hydrateAssignments(
      {
        formation: '4-3-3',
        slots: [
          { slotKey: 'ZZ9', playerId: 1 },
          { slotKey: 'M1', playerId: 2 },
          { slotKey: 'M2', playerId: 2 }, // duplicate player
        ],
      },
      F433, roster,
    );
    expect(a).toEqual({ M1: 2 });
  });
});

describe('moveOrSwap', () => {
  const base: Assignments = { GK: 1, D1: 2, M1: 3 };

  it('slot↔slot swaps occupants; into an empty slot moves', () => {
    const swapped = moveOrSwap(base, { kind: 'slot', key: 'GK' }, { kind: 'slot', key: 'D1' });
    expect(swapped['GK']).toBe(2);
    expect(swapped['D1']).toBe(1);

    const moved = moveOrSwap(base, { kind: 'slot', key: 'M1' }, { kind: 'slot', key: 'M2' });
    expect(moved['M2']).toBe(3);
    expect('M1' in moved).toBe(false);
  });

  it('slot↔bench swaps in the bench player, occupant drops to bench', () => {
    const next = moveOrSwap(base, { kind: 'slot', key: 'GK' }, { kind: 'bench', playerId: 9 });
    expect(next['GK']).toBe(9);
    expect(Object.values(next)).not.toContain(1);
  });

  it('bench→slot places the player over the occupant', () => {
    const next = moveOrSwap(base, { kind: 'bench', playerId: 9 }, { kind: 'slot', key: 'D1' });
    expect(next['D1']).toBe(9);
    expect(Object.values(next)).not.toContain(2);
  });

  it('never mutates its input and bench→bench is a no-op', () => {
    const before = { ...base };
    const out = moveOrSwap(base, { kind: 'bench', playerId: 9 }, { kind: 'bench', playerId: 8 });
    expect(base).toEqual(before);
    expect(out).toEqual(before);
  });

  it('clearSlot empties a slot', () => {
    expect('GK' in clearSlot(base, 'GK')).toBe(false);
  });
});

describe('remapFormation', () => {
  it('keeps players in their line; shrinking lines drop overflow, growing lines gain empties', () => {
    // 4-3-3 fully assigned: ids by slot order.
    const a: Assignments = {};
    F433.slots.forEach((s, i) => { a[s.key] = i + 1; });

    const to442 = remapFormation(a, F433, F442);
    expect(to442['GK']).toBe(1);
    // DEF line: 4 → 4, all kept in order.
    expect([to442['D1'], to442['D2'], to442['D3'], to442['D4']]).toEqual([2, 3, 4, 5]);
    // MID 3 → 4: three filled, one empty.
    expect(Object.keys(to442).filter(k => k.startsWith('M'))).toHaveLength(3);
    // ATT 3 → 2: one attacker dropped to bench.
    expect(Object.keys(to442).filter(k => k.startsWith('A'))).toHaveLength(2);
    expect(Object.values(to442)).toHaveLength(10);

    // And into 5-3-2: DEF grows to 5 (4 filled), MID 3 kept, ATT shrinks 3→2:
    // 1 GK + 4 DEF + 3 MID + 2 ATT = 10 placed, one attacker to the bench.
    const to532 = remapFormation(a, F433, F532);
    expect(Object.keys(to532).filter(k => k.startsWith('D'))).toHaveLength(4);
    expect(Object.values(to532)).toHaveLength(10);
  });
});

describe('formationChangeSummary', () => {
  it('previews the remap without applying: shrink → benched names, fit → none benched', () => {
    const a: Assignments = {};
    F433.slots.forEach((s, i) => { a[s.key] = i + 1; });

    // 4-3-3 → 4-4-2: the ATT line shrinks 3→2, exactly one attacker benched.
    const to442 = formationChangeSummary(a, F433, F442);
    expect(to442.kept).toBe(10);
    expect(to442.benched).toHaveLength(1);
    const attIds = F433.slots.filter(s => s.key.startsWith('A')).map(s => a[s.key]);
    expect(attIds).toContain(to442.benched[0]);
    expect(Object.values(a)).toHaveLength(11); // pure: input untouched

    // Partial lineup that fits entirely: nobody benched.
    const partial: Assignments = { GK: 1, D1: 2, M1: 3 };
    const summary = formationChangeSummary(partial, F433, F532);
    expect(summary.benched).toEqual([]);
    expect(summary.kept).toBe(3);
  });
});

describe('validateLineup / toSaveSlots / sameLineup', () => {
  const roster = new Set([1, 2, 3]);

  it('flags unknown slots, duplicates, off-roster players; passes clean data', () => {
    expect(validateLineup({ GK: 1, D1: 2 }, F433, roster)).toEqual([]);
    expect(validateLineup({ XX: 1 }, F433, roster)).toContain('unknownSlot');
    expect(validateLineup({ GK: 1, D1: 1 }, F433, roster)).toContain('duplicatePlayer');
    expect(validateLineup({ GK: 99 }, F433, roster)).toContain('offRosterPlayer');
  });

  it('toSaveSlots is deterministic; sameLineup tracks dirty state', () => {
    expect(toSaveSlots({ M1: 3, GK: 1 })).toEqual([
      { slotKey: 'GK', playerId: 1 },
      { slotKey: 'M1', playerId: 3 },
    ]);
    expect(sameLineup('4-3-3', { GK: 1 }, '4-3-3', { GK: 1 })).toBe(true);
    expect(sameLineup('4-3-3', { GK: 1 }, '4-4-2', { GK: 1 })).toBe(false);
    expect(sameLineup('4-3-3', { GK: 1 }, '4-3-3', { GK: 2 })).toBe(false);
    expect(sameLineup('4-3-3', { GK: 1 }, '4-3-3', {})).toBe(false);
  });

  it('isOutOfPosition flags unnatural placements only', () => {
    const gk = F433.slots.find(s => s.key === 'GK')!;
    expect(isOutOfPosition(gk, 5)).toBe(true);  // striker in goal
    expect(isOutOfPosition(gk, 1)).toBe(false);
    expect(isOutOfPosition(gk, null)).toBe(false); // unknown position: no claim
  });
});
