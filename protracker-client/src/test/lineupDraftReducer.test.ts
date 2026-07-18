import { describe, it, expect } from 'vitest';
import {
  draftReducer, canUndo, canRedo, HISTORY_LIMIT, type Draft, type DraftHistory,
} from '../components/teams/lineup/lineupDraftReducer';
import { emptyTactical, type TacticalState } from '../components/teams/lineup/lineupTacticalLogic';

const d = (formationKey: string, assignments: Record<string, number>, tactical?: Partial<TacticalState>): Draft =>
  ({ formationKey, assignments, tactical: { ...emptyTactical(), ...tactical } });

const begin = (draft: Draft): DraftHistory =>
  draftReducer(null, { type: 'begin', draft })!;

describe('draftReducer', () => {
  it('begin initializes a fresh history (no past, no future)', () => {
    const s = begin(d('4-3-3', { GK: 1 }));
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.present.assignments).toEqual({ GK: 1 });
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
  });

  it('end returns to view mode (null)', () => {
    const s = begin(d('4-3-3', {}));
    expect(draftReducer(s, { type: 'end' })).toBeNull();
  });

  it('apply pushes the previous present onto past and clears future', () => {
    let s = begin(d('4-3-3', { GK: 1 }));
    s = draftReducer(s, { type: 'apply', draft: d('4-3-3', { GK: 2 }) })!;
    s = draftReducer(s, { type: 'undo' })!;
    expect(s.future).toHaveLength(1);
    s = draftReducer(s, { type: 'apply', draft: d('4-3-3', { GK: 3 }) })!;
    expect(s.future).toEqual([]); // a new branch kills redo
    expect(s.past.map(p => p.assignments.GK)).toEqual([1]);
    expect(s.present.assignments.GK).toBe(3);
  });

  it('applying an identical draft is a no-op (history stays clean)', () => {
    const s0 = begin(d('4-3-3', { GK: 1, D1: 2 }));
    const s1 = draftReducer(s0, { type: 'apply', draft: d('4-3-3', { GK: 1, D1: 2 }) });
    expect(s1).toBe(s0);
  });

  it('undo/redo round-trips exact drafts', () => {
    let s = begin(d('4-3-3', { GK: 1 }));
    s = draftReducer(s, { type: 'apply', draft: d('4-3-3', { GK: 1, ST: 9 }) })!;
    s = draftReducer(s, { type: 'apply', draft: d('4-4-2', { GK: 1 }) })!;
    s = draftReducer(s, { type: 'undo' })!;
    expect(s.present).toEqual(d('4-3-3', { GK: 1, ST: 9 }));
    s = draftReducer(s, { type: 'undo' })!;
    expect(s.present).toEqual(d('4-3-3', { GK: 1 }));
    expect(canUndo(s)).toBe(false);
    s = draftReducer(s, { type: 'redo' })!;
    s = draftReducer(s, { type: 'redo' })!;
    expect(s.present).toEqual(d('4-4-2', { GK: 1 }));
    expect(canRedo(s)).toBe(false);
  });

  it('undo with no past / redo with no future are no-ops', () => {
    const s = begin(d('4-3-3', {}));
    expect(draftReducer(s, { type: 'undo' })).toBe(s);
    expect(draftReducer(s, { type: 'redo' })).toBe(s);
    expect(draftReducer(null, { type: 'undo' })).toBeNull();
    expect(draftReducer(null, { type: 'apply', draft: d('x', {}) })).toBeNull();
  });

  it('history is capped: oldest steps drop beyond HISTORY_LIMIT', () => {
    let s = begin(d('4-3-3', { GK: 0 }));
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) {
      s = draftReducer(s, { type: 'apply', draft: d('4-3-3', { GK: i }) })!;
    }
    expect(s.past).toHaveLength(HISTORY_LIMIT);
    expect(s.past[0].assignments.GK).toBe(10); // 0..9 dropped
    expect(s.present.assignments.GK).toBe(HISTORY_LIMIT + 10);
  });
});

// Phase 3: tactical edits ride the same history — one apply = one undo step,
// and a tactical no-op never pollutes the past.
describe('draftReducer — tactical state', () => {
  it('a tactical-only change is exactly one undo step', () => {
    let s = begin(d('4-3-3', { GK: 1 }));
    s = draftReducer(s, { type: 'apply', draft: d('4-3-3', { GK: 1 }, { captainId: 1 }) })!;
    expect(s.past).toHaveLength(1);
    expect(s.present.tactical.captainId).toBe(1);
    s = draftReducer(s, { type: 'undo' })!;
    expect(s.present.tactical.captainId).toBeNull();
    s = draftReducer(s, { type: 'redo' })!;
    expect(s.present.tactical.captainId).toBe(1);
  });

  it('an identical tactical state is a no-op apply', () => {
    let s = begin(d('4-3-3', { GK: 1 }, { labels: ['highPress'], roles: { GK: 'sweeperKeeper' } }));
    const same = d('4-3-3', { GK: 1 }, { labels: ['highPress'], roles: { GK: 'sweeperKeeper' } });
    s = draftReducer(s, { type: 'apply', draft: same })!;
    expect(s.past).toHaveLength(0);
  });
});
