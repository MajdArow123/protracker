import { describe, it, expect } from 'vitest';
import {
  classifyConflict,
  contextKey,
  contextRequestParams,
  contextToSaveTarget,
  sameContext,
  canEditLineup,
  namedLineupCap,
  MAX_NAMED_LINEUPS,
  applyPresetToDraft,
  computePresetDiff,
  publishedRosterDrift,
  type LineupContext,
  type PresetContent,
  type DraftLike,
} from '../components/teams/lineup/lineupWorkflowLogic';
import { SOCCER_FORMATIONS } from '../components/teams/lineup/lineupFormations';
import { emptyTactical } from '../components/teams/lineup/lineupTacticalLogic';

// ── classifyConflict ─────────────────────────────────────────────────────────

describe('classifyConflict', () => {
  it('a missing row is a deleted conflict with no editor context', () => {
    expect(classifyConflict(null)).toEqual({
      kind: 'deleted', editedByName: null, editedAt: null, currentVersion: null,
    });
  });

  it('a Published row is the published lock', () => {
    const info = classifyConflict({
      status: 'Published', version: 3, updatedAt: '2026-07-31T10:00:00Z', updatedByName: 'Coach Daniels',
    });
    expect(info.kind).toBe('published');
    expect(info.currentVersion).toBe(3);
  });

  // PINNED (approval refinement 1): a version conflict must carry WHO edited
  // and WHEN, verbatim, so the Overwrite choice is informed — never blind.
  it('a Draft row is a version conflict carrying editor name + timestamp + current version', () => {
    const info = classifyConflict({
      status: 'Draft', version: 7, updatedAt: '2026-07-30T18:45:00Z', updatedByName: 'Assistant Reyes',
    });
    expect(info).toEqual({
      kind: 'version',
      editedByName: 'Assistant Reyes',
      editedAt: '2026-07-30T18:45:00Z',
      currentVersion: 7,
    });
  });

  it('an unknown editor stays null (rendered as a missing value, never invented)', () => {
    const info = classifyConflict({ status: 'Draft', version: 2, updatedAt: '2026-07-30T18:45:00Z', updatedByName: null });
    expect(info.kind).toBe('version');
    expect(info.editedByName).toBeNull();
  });
});

// ── Context key parity (the no-regression pin for the refactor) ──────────────

describe('contextKey', () => {
  // The pre-Phase-6 key was: ['lineup', teamId, matchId ?? 'default'].
  // These two literals are the CACHE-PARITY CONTRACT: default and match
  // contexts must produce byte-identical keys or the refactor moves caches.
  it('default context matches the legacy lineupKey exactly', () => {
    expect(contextKey(7, { kind: 'default' })).toEqual(['lineup', 7, 'default']);
  });

  it('match context matches the legacy lineupKey exactly', () => {
    expect(contextKey(7, { kind: 'match', matchId: 42 })).toEqual(['lineup', 7, 42]);
  });

  it('named context uses a collision-free namespace, case-insensitively', () => {
    expect(contextKey(7, { kind: 'named', name: '  First Team ' })).toEqual(['lineup', 7, 'named:first team']);
    // 'named:5' (string) can never collide with matchId 5 (number).
    expect(contextKey(7, { kind: 'named', name: '5' })).toEqual(['lineup', 7, 'named:5']);
    expect(contextKey(7, { kind: 'match', matchId: 5 })[2]).toBe(5);
  });
});

describe('context request/save mapping parity', () => {
  it('default context emits the legacy request + payload shapes', () => {
    expect(contextRequestParams({ kind: 'default' })).toEqual({ matchId: null, name: null });
    expect(contextToSaveTarget({ kind: 'default' })).toEqual({ matchResultId: null, name: null });
  });

  it('match context emits the legacy request + payload shapes (name always null)', () => {
    expect(contextRequestParams({ kind: 'match', matchId: 9 })).toEqual({ matchId: 9, name: null });
    expect(contextToSaveTarget({ kind: 'match', matchId: 9 })).toEqual({ matchResultId: 9, name: null });
  });

  it('named context emits trimmed name and no matchId (two-key model)', () => {
    expect(contextRequestParams({ kind: 'named', name: ' Rotation ' })).toEqual({ matchId: null, name: 'Rotation' });
    expect(contextToSaveTarget({ kind: 'named', name: ' Rotation ' })).toEqual({ matchResultId: null, name: 'Rotation' });
  });

  it('sameContext treats named case-insensitively and kinds strictly', () => {
    const a: LineupContext = { kind: 'named', name: 'FIRST team' };
    expect(sameContext(a, { kind: 'named', name: 'first team' })).toBe(true);
    expect(sameContext(a, { kind: 'default' })).toBe(false);
    expect(sameContext({ kind: 'match', matchId: 1 }, { kind: 'match', matchId: 2 })).toBe(false);
  });
});

// ── Published lock ───────────────────────────────────────────────────────────

describe('canEditLineup', () => {
  it('unsaved and Draft are editable; Published is locked', () => {
    expect(canEditLineup(null)).toBe(true);
    expect(canEditLineup(undefined)).toBe(true);
    expect(canEditLineup('Draft')).toBe(true);
    expect(canEditLineup('Published')).toBe(false);
  });
});

// ── Named-lineup cap ─────────────────────────────────────────────────────────

describe('namedLineupCap', () => {
  it('counts only named TEAM lineups — default and match rows never count', () => {
    const cap = namedLineupCap([
      { matchResultId: null, name: null },        // default XI
      { matchResultId: 12, name: null },          // match lineup
      { matchResultId: null, name: 'First Team' },
      { matchResultId: null, name: 'Rotation' },
    ]);
    expect(cap).toEqual({ used: 2, max: MAX_NAMED_LINEUPS, reached: false });
  });

  it('reaches at exactly the cap', () => {
    const list = Array.from({ length: MAX_NAMED_LINEUPS }, (_, i) => ({ matchResultId: null, name: `L${i}` }));
    expect(namedLineupCap(list).reached).toBe(true);
    expect(namedLineupCap(list.slice(1)).reached).toBe(false);
  });
});

// ── Preset apply-diff ────────────────────────────────────────────────────────

// 4-3-3 slots: GK, D1..D4, M1..M3, A1..A3. 4-4-2 shrinks ATT to A1..A2.
const F433 = SOCCER_FORMATIONS.find(f => f.key === '4-3-3')!;

function draft433(): DraftLike {
  return {
    formationKey: F433.key,
    assignments: { GK: 1, D1: 2, D2: 3, M1: 4, A1: 5, A2: 6, A3: 7 },
    tactical: {
      ...emptyTactical(),
      captainId: 7,
      notes: 'press high on their left',
      labels: ['highPress'],
      roles: { GK: 'sweeperKeeper', A1: 'falseNine' },
      setPieces: { penalties: 7, cornersLeft: 5 },
    },
  };
}

describe('preset apply-diff', () => {
  it('replace-all over the preset domain: roles set/changed/cleared + labels added/removed', () => {
    const preset: PresetContent = {
      formation: null,
      roles: { GK: 'sweeperKeeper', A1: 'targetMan', D1: 'ballPlaying' },
      labels: ['counter'],
    };
    const diff = computePresetDiff(draft433(), preset, SOCCER_FORMATIONS);
    expect(diff).toContainEqual({ kind: 'roleChanged', slotKey: 'A1', from: 'falseNine', to: 'targetMan' });
    expect(diff).toContainEqual({ kind: 'roleSet', slotKey: 'D1', role: 'ballPlaying' });
    expect(diff).toContainEqual({ kind: 'labelRemoved', label: 'highPress' });
    expect(diff).toContainEqual({ kind: 'labelAdded', label: 'counter' });
    // GK role identical → not in the diff.
    expect(diff.some(e => e.kind === 'roleSet' && e.slotKey === 'GK')).toBe(false);
    expect(diff.some(e => e.kind === 'roleChanged' && 'slotKey' in e && e.slotKey === 'GK')).toBe(false);
  });

  it('a preset role for an EMPTY slot is dropped, not faked (roles ride occupied slots)', () => {
    const preset: PresetContent = { formation: null, roles: { M3: 'anchor' }, labels: [] };
    const after = applyPresetToDraft(draft433(), preset, SOCCER_FORMATIONS);
    expect(after.tactical.roles.M3).toBeUndefined();
    const diff = computePresetDiff(draft433(), preset, SOCCER_FORMATIONS);
    expect(diff.some(e => 'slotKey' in e && e.slotKey === 'M3')).toBe(false);
  });

  it('formation change remaps by line, names the benched, and surfaces a benched captaincy clear', () => {
    // 4-3-3 → 4-4-2: ATT shrinks 3→2, so A3's occupant (7, the captain) benches.
    const preset: PresetContent = { formation: '4-4-2', roles: {}, labels: [] };
    const before = draft433();
    const after = applyPresetToDraft(before, preset, SOCCER_FORMATIONS);
    expect(after.formationKey).toBe('4-4-2');
    expect(Object.values(after.assignments)).not.toContain(7);
    expect(after.tactical.captainId).toBeNull(); // pruneTactical: captain must be in the XI
    expect(after.tactical.setPieces.penalties).toBeUndefined(); // taker 7 benched too
    expect(after.tactical.setPieces.cornersLeft).toBe(5); // taker 5 survived the remap — duty untouched
  });

  it('the diff is derived from apply — every consequence is visible, nothing hidden', () => {
    const preset: PresetContent = { formation: '4-4-2', roles: {}, labels: [] };
    const diff = computePresetDiff(draft433(), preset, SOCCER_FORMATIONS);
    expect(diff).toContainEqual({ kind: 'formation', from: '4-3-3', to: '4-4-2', benched: [7] });
    expect(diff).toContainEqual({ kind: 'captainCleared', playerId: 7 });
    expect(diff).toContainEqual({ kind: 'setPieceCleared', type: 'penalties', playerId: 7 });
    // roles replace-all with {} clears both existing roles
    expect(diff).toContainEqual({ kind: 'roleCleared', slotKey: 'GK', from: 'sweeperKeeper' });
  });

  it('notes and surviving set-pieces pass through verbatim — presets never touch them', () => {
    const preset: PresetContent = { formation: null, roles: {}, labels: [] };
    const after = applyPresetToDraft(draft433(), preset, SOCCER_FORMATIONS);
    expect(after.tactical.notes).toBe('press high on their left');
    expect(after.tactical.setPieces).toEqual({ penalties: 7, cornersLeft: 5 });
    expect(after.tactical.captainId).toBe(7);
    expect(after.assignments).toEqual(draft433().assignments);
  });

  it('an unknown preset formation is ignored (no fake formation entry)', () => {
    const preset: PresetContent = { formation: '9-9-9', roles: { GK: 'sweeperKeeper' }, labels: ['highPress'] };
    const before = draft433();
    const after = applyPresetToDraft(before, preset, SOCCER_FORMATIONS);
    expect(after.formationKey).toBe('4-3-3');
    const diff = computePresetDiff(before, preset, SOCCER_FORMATIONS);
    expect(diff.some(e => e.kind === 'formation')).toBe(false);
    // A1 role cleared by replace-all is still an honest entry.
    expect(diff).toContainEqual({ kind: 'roleCleared', slotKey: 'A1', from: 'falseNine' });
  });

  it('a preset matching the draft yields an EMPTY diff (Apply disabled)', () => {
    const before = draft433();
    const preset: PresetContent = {
      formation: '4-3-3',
      roles: { GK: 'sweeperKeeper', A1: 'falseNine' },
      labels: ['highPress'],
    };
    expect(computePresetDiff(before, preset, SOCCER_FORMATIONS)).toEqual([]);
  });

  it('diff ≡ apply: re-diffing the applied state against the same preset is empty', () => {
    const preset: PresetContent = { formation: '4-4-2', roles: { GK: 'sweeperKeeper', D2: 'stopper' }, labels: ['counter'] };
    const once = applyPresetToDraft(draft433(), preset, SOCCER_FORMATIONS);
    expect(computePresetDiff(once, preset, SOCCER_FORMATIONS)).toEqual([]);
  });
});

describe('publishedRosterDrift', () => {
  const roster = new Set([1, 2, 3, 4]);

  it('is empty when every referenced player is on the roster', () => {
    expect(publishedRosterDrift({
      slots: [{ slotKey: 'GK', playerId: 1 }, { slotKey: 'D1', playerId: 2 }],
      captainPlayerId: 1,
      viceCaptainPlayerId: 2,
      setPieces: [{ type: 'penalties', playerId: 3 }],
    }, roster)).toEqual([]);
  });

  it('reports departed slot players, captains, and set-piece takers — unique and sorted', () => {
    expect(publishedRosterDrift({
      slots: [{ slotKey: 'GK', playerId: 9 }, { slotKey: 'D1', playerId: 2 }, { slotKey: 'D2', playerId: 9 }],
      captainPlayerId: 7,
      viceCaptainPlayerId: null,
      setPieces: [{ type: 'penalties', playerId: 8 }, { type: 'cornersLeft', playerId: 7 }],
    }, roster)).toEqual([7, 8, 9]);
  });

  it('handles a lineup with no tactical references', () => {
    expect(publishedRosterDrift({
      slots: [{ slotKey: 'GK', playerId: 5 }],
      captainPlayerId: null,
      viceCaptainPlayerId: null,
      setPieces: [],
    }, roster)).toEqual([5]);
  });
});
