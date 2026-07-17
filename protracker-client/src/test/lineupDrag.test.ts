import { describe, it, expect } from 'vitest';
import {
  dragCommit, hitTest, sameDropTarget, dragArmDecision,
  MOUSE_DRAG_THRESHOLD_PX, TOUCH_HOLD_MS, TOUCH_JITTER_PX,
  type DropTarget, type TargetRect,
} from '../components/teams/lineup/lineupDragLogic';
import { moveOrSwap, clearSlot, type Assignments, type Selection } from '../components/teams/lineup/lineupEditLogic';

const A: Assignments = { GK: 1, D1: 2, ST: 9 };

describe('dragCommit — drag is the same commit as tap-swap', () => {
  const selectionPairs: Array<[Selection, Selection]> = [
    [{ kind: 'slot', key: 'GK' }, { kind: 'slot', key: 'D1' }],   // slot↔slot swap
    [{ kind: 'slot', key: 'GK' }, { kind: 'slot', key: 'M1' }],   // slot→empty slot
    [{ kind: 'slot', key: 'M1' }, { kind: 'slot', key: 'GK' }],   // empty→occupied
    [{ kind: 'slot', key: 'ST' }, { kind: 'bench', playerId: 7 }], // slot↔bench swap
    [{ kind: 'bench', playerId: 7 }, { kind: 'slot', key: 'D1' }], // bench→slot
    [{ kind: 'bench', playerId: 7 }, { kind: 'slot', key: 'M1' }], // bench→empty slot
  ];

  it.each(selectionPairs.map((p, i) => [i, ...p] as const))(
    'pair %i: dragCommit ≡ moveOrSwap for Selection targets',
    (_i, source, target) => {
      expect(dragCommit(A, source, target)).toEqual(moveOrSwap(A, source, target));
    },
  );

  it('release outside every target is identity — a drag NEVER silently drops a player', () => {
    for (const source of [{ kind: 'slot', key: 'GK' } as Selection, { kind: 'bench', playerId: 7 } as Selection]) {
      const result = dragCommit(A, source, null);
      expect(result).toEqual(A);
    }
  });

  it('slot → bench area = send to bench (clearSlot), bench → bench area = identity', () => {
    expect(dragCommit(A, { kind: 'slot', key: 'ST' }, { kind: 'benchArea' }))
      .toEqual(clearSlot(A, 'ST'));
    expect(dragCommit(A, { kind: 'bench', playerId: 7 }, { kind: 'benchArea' })).toEqual(A);
  });
});

describe('hitTest', () => {
  const rects: TargetRect<DropTarget>[] = [
    { target: { kind: 'slot', key: 'GK' }, left: 10, top: 10, right: 50, bottom: 50 },
    { target: { kind: 'bench', playerId: 7 }, left: 40, top: 40, right: 100, bottom: 100 },
    { target: { kind: 'benchArea' }, left: 0, top: 0, right: 200, bottom: 200 },
  ];

  it('returns the first (most specific) match on overlap', () => {
    expect(hitTest(45, 45, rects)).toEqual({ kind: 'slot', key: 'GK' }); // slot beats bench + area
    expect(hitTest(80, 80, rects)).toEqual({ kind: 'bench', playerId: 7 });
    expect(hitTest(150, 150, rects)).toEqual({ kind: 'benchArea' });
  });

  it('returns null outside every rect and for empty caches', () => {
    expect(hitTest(500, 500, rects)).toBeNull();
    expect(hitTest(45, 45, [])).toBeNull();
  });

  it('treats boundary pixels as inside', () => {
    expect(hitTest(10, 10, rects)).toEqual({ kind: 'slot', key: 'GK' });
    expect(hitTest(50, 50, rects)).toEqual({ kind: 'slot', key: 'GK' });
  });
});

describe('sameDropTarget', () => {
  it('matches by kind + payload', () => {
    expect(sameDropTarget({ kind: 'slot', key: 'GK' }, { kind: 'slot', key: 'GK' })).toBe(true);
    expect(sameDropTarget({ kind: 'slot', key: 'GK' }, { kind: 'slot', key: 'D1' })).toBe(false);
    expect(sameDropTarget({ kind: 'bench', playerId: 1 }, { kind: 'bench', playerId: 1 })).toBe(true);
    expect(sameDropTarget({ kind: 'bench', playerId: 1 }, { kind: 'bench', playerId: 2 })).toBe(false);
    expect(sameDropTarget({ kind: 'benchArea' }, { kind: 'benchArea' })).toBe(true);
    expect(sameDropTarget({ kind: 'slot', key: 'GK' }, { kind: 'benchArea' })).toBe(false);
    expect(sameDropTarget(null, null)).toBe(true);
    expect(sameDropTarget(null, { kind: 'benchArea' })).toBe(false);
  });
});

describe('dragArmDecision', () => {
  it('mouse: distance-based — a plain click stays a tap', () => {
    expect(dragArmDecision('mouse', 0, 9999)).toBe('wait'); // time alone never arms a mouse drag
    expect(dragArmDecision('mouse', MOUSE_DRAG_THRESHOLD_PX - 1, 0)).toBe('wait');
    expect(dragArmDecision('mouse', MOUSE_DRAG_THRESHOLD_PX, 0)).toBe('begin');
  });

  it('touch: hold-to-drag — early movement cancels so scroll/pan wins', () => {
    expect(dragArmDecision('touch', 0, TOUCH_HOLD_MS - 1)).toBe('wait');
    expect(dragArmDecision('touch', 0, TOUCH_HOLD_MS)).toBe('begin');
    expect(dragArmDecision('touch', TOUCH_JITTER_PX + 1, 50)).toBe('cancel');
    expect(dragArmDecision('touch', TOUCH_JITTER_PX, 50)).toBe('wait'); // jitter tolerated
    expect(dragArmDecision('pen', TOUCH_JITTER_PX + 1, 50)).toBe('cancel'); // pen behaves like touch
  });
});
