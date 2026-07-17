import { clearSlot, moveOrSwap, type Assignments, type Selection } from './lineupEditLogic';

// Pure logic for the hand-rolled pointer drag (Phase 1). The DOM hook
// (useLineupDrag) is a thin shell over these — exported and unit-tested
// (src/test/lineupDrag.test.ts).
//
// The honesty contract of drag: it is ONLY an alternative gesture for the
// exact same commits tap-swap makes. `dragCommit` routes Selection targets
// through `moveOrSwap` verbatim, and a release outside every target is an
// identity — a drag can never silently drop a player.

/** A drop target is a tap-swap Selection, or the bench area (= send to bench). */
export type DropTarget = Selection | { kind: 'benchArea' };

/**
 * Resolve a drag release. null target (released outside everything) and
 * bench→benchArea are identity — nothing changes, nothing is dropped.
 */
export function dragCommit(assignments: Assignments, source: Selection, target: DropTarget | null): Assignments {
  if (target == null) return assignments;
  if (target.kind === 'benchArea') {
    return source.kind === 'slot' ? clearSlot(assignments, source.key) : assignments;
  }
  return moveOrSwap(assignments, source, target);
}

export interface TargetRect<T> {
  target: T;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Point-in-rect over a rect cache captured once at drag start (never per-move
 * layout reads). First match wins — callers order rects most-specific first
 * (slots, then bench cards, then the bench area container).
 */
export function hitTest<T>(x: number, y: number, rects: readonly TargetRect<T>[]): T | null {
  for (const r of rects) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return r.target;
  }
  return null;
}

/** Identity for hover-target change detection (drives the highlight redraws). */
export function sameDropTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'slot' && b.kind === 'slot') return a.key === b.key;
  if (a.kind === 'bench' && b.kind === 'bench') return a.playerId === b.playerId;
  return true; // benchArea
}

export const MOUSE_DRAG_THRESHOLD_PX = 6;
export const TOUCH_HOLD_MS = 250;
export const TOUCH_JITTER_PX = 8;

/**
 * Arming decision, evaluated as the pointer moves / time passes.
 * Mouse: a real drag is distance-based (a plain click stays a tap-swap tap).
 * Touch/pen: hold-to-drag — early movement means a scroll/pan, so the arm
 * cancels and the browser keeps the gesture (bench carousel, page scroll).
 */
export function dragArmDecision(
  pointerType: string,
  distancePx: number,
  heldMs: number,
): 'begin' | 'cancel' | 'wait' {
  if (pointerType === 'mouse') {
    return distancePx >= MOUSE_DRAG_THRESHOLD_PX ? 'begin' : 'wait';
  }
  if (heldMs >= TOUCH_HOLD_MS) return 'begin';
  return distancePx > TOUCH_JITTER_PX ? 'cancel' : 'wait';
}
