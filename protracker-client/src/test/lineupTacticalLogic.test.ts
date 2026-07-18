import { describe, it, expect } from 'vitest';
import {
  emptyTactical, hydrateTactical, pruneTactical, sameTactical, buildSaveInput,
  hasTacticalContent, positionFit, slotKeysOf, type TacticalState,
} from '../components/teams/lineup/lineupTacticalLogic';
import { formationOrDefault, type FormationSlot } from '../components/teams/lineup/lineupFormations';

const f433 = formationOrDefault(1, '4-3-3')!;
const KEYS = f433.slots.map(s => s.key);
const [K0, K1, K2] = KEYS; // real soccer slot keys (GK + two defenders)

const tactical = (over: Partial<TacticalState> = {}): TacticalState => ({ ...emptyTactical(), ...over });

describe('buildSaveInput — the write-through contract', () => {
  // REQUIRED BY REVIEW: the server clears whatever is omitted, so the payload
  // must ALWAYS carry the complete tactical state.
  it('includes captain/vice/notes/labels/roles/set pieces whenever set', () => {
    const assignments = { [K0]: 1, [K1]: 2, [K2]: 3 };
    const input = buildSaveInput(7, '4-3-3', assignments, tactical({
      captainId: 1,
      viceCaptainId: 2,
      notes: '  Press high.  ',
      labels: ['highPress', 'counter'],
      roles: { [K0]: 'sweeperKeeper', [K2]: 'poacher' },
      setPieces: { penalties: 3, cornersLeft: 2 },
    }));

    expect(input.matchResultId).toBe(7);
    expect(input.formation).toBe('4-3-3');
    expect(input.captainPlayerId).toBe(1);
    expect(input.viceCaptainPlayerId).toBe(2);
    expect(input.notes).toBe('Press high.');
    expect(input.tacticalLabels).toEqual(['highPress', 'counter']);
    expect(input.setPieces).toEqual([
      { type: 'cornersLeft', playerId: 2 },
      { type: 'penalties', playerId: 3 },
    ]);
    expect(input.slots.find(s => s.slotKey === K0)?.role).toBe('sweeperKeeper');
    expect(input.slots.find(s => s.slotKey === K2)?.role).toBe('poacher');
    expect(input.slots.find(s => s.slotKey === K1)?.role).toBeNull();
  });

  it('always emits every tactical field — explicit null/empty, never omitted', () => {
    const input = buildSaveInput(null, '4-3-3', { [K0]: 1 }, emptyTactical());
    // Field PRESENCE is the contract: a missing key would silently wipe
    // nothing today but breaks the moment serialization skips undefined.
    expect(Object.keys(input)).toEqual(expect.arrayContaining([
      'matchResultId', 'formation', 'captainPlayerId', 'viceCaptainPlayerId',
      'notes', 'tacticalLabels', 'slots', 'setPieces',
    ]));
    expect(input.captainPlayerId).toBeNull();
    expect(input.viceCaptainPlayerId).toBeNull();
    expect(input.notes).toBeNull();
    expect(input.tacticalLabels).toEqual([]);
    expect(input.setPieces).toEqual([]);
    expect(input.slots).toEqual([{ slotKey: K0, playerId: 1, role: null, instructions: null }]);
  });

  it('blank notes normalize to null (server NullIfBlank parity)', () => {
    expect(buildSaveInput(null, '4-3-3', {}, tactical({ notes: '   ' })).notes).toBeNull();
  });
});

describe('hydrateTactical — roster-keyed drop, mirroring slots', () => {
  const savedBase = {
    captainPlayerId: 1,
    viceCaptainPlayerId: 2,
    notes: 'note',
    tacticalLabels: ['highPress'],
    slots: [
      { slotKey: K0, playerId: 1, role: 'sweeperKeeper' },
      { slotKey: K1, playerId: 2, role: null },
    ],
    setPieces: [{ type: 'penalties', playerId: 2 }],
  };

  it('keeps everything when captain/vice/takers survive hydration', () => {
    const assignments = { [K0]: 1, [K1]: 2 };
    const t = hydrateTactical(savedBase, assignments, new Set([1, 2]));
    expect(t.captainId).toBe(1);
    expect(t.viceCaptainId).toBe(2);
    expect(t.roles).toEqual({ [K0]: 'sweeperKeeper' });
    expect(t.setPieces).toEqual({ penalties: 2 });
    expect(t.labels).toEqual(['highPress']);
  });

  it('drops a departed captain and taker to empty — never a ghost id', () => {
    // Player 2 left the roster: their slot did not hydrate either.
    const assignments = { [K0]: 1 };
    const t = hydrateTactical(savedBase, assignments, new Set([1]));
    expect(t.captainId).toBe(1);
    expect(t.viceCaptainId).toBeNull();
    expect(t.setPieces).toEqual({});
    expect(t.roles).toEqual({ [K0]: 'sweeperKeeper' }); // survivor keeps the role
  });

  it('a pre-tactical response (missing arrays/fields) hydrates to empty — never crashes', () => {
    // Found live: an old cached LineupDto without tacticalLabels/setPieces
    // crashed the board. Wire data is Partial by design.
    const t = hydrateTactical(
      { slots: [{ slotKey: K0, playerId: 1 }] } as never,
      { [K0]: 1 },
      new Set([1]),
    );
    expect(t).toEqual(emptyTactical());
  });

  it('guards corrupt captain==vice data (vice drops)', () => {
    const t = hydrateTactical(
      { ...savedBase, viceCaptainPlayerId: 1 },
      { [K0]: 1, [K1]: 2 },
      new Set([1, 2]),
    );
    expect(t.captainId).toBe(1);
    expect(t.viceCaptainId).toBeNull();
  });
});

describe('pruneTactical — invariants re-established on every draft change', () => {
  const keys = slotKeysOf(f433);

  it('nulls the captaincy and removes takers when the player leaves the XI', () => {
    const before = tactical({ captainId: 1, viceCaptainId: 2, setPieces: { penalties: 1, cornersLeft: 2 } });
    const after = pruneTactical(before, { [K0]: 2 }, keys); // player 1 benched
    expect(after.captainId).toBeNull();
    expect(after.viceCaptainId).toBe(2);
    expect(after.setPieces).toEqual({ cornersLeft: 2 });
  });

  it('drops roles for emptied or unknown slots', () => {
    const before = tactical({ roles: { [K0]: 'sweeperKeeper', [K1]: 'poacher', NOPE: 'x' } });
    const after = pruneTactical(before, { [K0]: 1 }, keys); // K1 emptied, NOPE unknown
    expect(after.roles).toEqual({ [K0]: 'sweeperKeeper' });
  });

  it('returns the SAME object when nothing changed (reducer no-op detection)', () => {
    const before = tactical({ captainId: 1, roles: { [K0]: 'sweeperKeeper' } });
    expect(pruneTactical(before, { [K0]: 1 }, keys)).toBe(before);
  });
});

describe('sameTactical / hasTacticalContent', () => {
  it('detects equality including label order and record contents', () => {
    const a = tactical({ labels: ['a', 'b'], roles: { [K0]: 'r' }, setPieces: { p: 1 } });
    expect(sameTactical(a, tactical({ labels: ['a', 'b'], roles: { [K0]: 'r' }, setPieces: { p: 1 } }))).toBe(true);
    expect(sameTactical(a, tactical({ labels: ['b', 'a'], roles: { [K0]: 'r' }, setPieces: { p: 1 } }))).toBe(false);
    expect(sameTactical(a, tactical({ labels: ['a', 'b'], roles: { [K0]: 'x' }, setPieces: { p: 1 } }))).toBe(false);
    expect(sameTactical(a, tactical({ labels: ['a', 'b'], roles: { [K0]: 'r' }, setPieces: { p: 2 } }))).toBe(false);
  });

  it('hasTacticalContent is false only for a truly empty state', () => {
    expect(hasTacticalContent(emptyTactical())).toBe(false);
    expect(hasTacticalContent(tactical({ notes: '  ' }))).toBe(false);
    expect(hasTacticalContent(tactical({ captainId: 3 }))).toBe(true);
    expect(hasTacticalContent(tactical({ labels: ['x'] }))).toBe(true);
  });
});

describe('positionFit — the sharper OOP hint', () => {
  const slot: FormationSlot = { key: 'D1', x: 0, y: 0, naturalPositionIds: [2], lineId: 'D' };

  it('natural for the primary position', () => {
    expect(positionFit(slot, 2, [])).toBe('natural');
  });
  it('secondary when only a coach-entered secondary matches', () => {
    expect(positionFit(slot, 5, [2, 3])).toBe('secondary');
  });
  it('oop when neither primary nor secondaries match', () => {
    expect(positionFit(slot, 5, [3])).toBe('oop');
    expect(positionFit(slot, 5, undefined)).toBe('oop');
  });
  it('unknown position claims nothing (natural, no invented mismatch)', () => {
    expect(positionFit(slot, null, [])).toBe('natural');
  });
});
