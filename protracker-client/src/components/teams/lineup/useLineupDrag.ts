import { useCallback, useEffect, useRef, useState } from 'react';
import type { Selection } from './lineupEditLogic';
import {
  dragArmDecision, hitTest, sameDropTarget, TOUCH_HOLD_MS, type DropTarget, type TargetRect,
} from './lineupDragLogic';

// DOM shell for the hand-rolled pointer drag (Phase 1). All decisions live in
// lineupDragLogic (pure, tested); this hook owns only browser mechanics:
//  - arming (mouse: 6px threshold; touch: 250ms hold so pans/scrolls win)
//  - a rect cache captured ONCE at drag start (no per-move layout reads)
//  - ghost positioning via rAF + direct style writes (no re-render per move)
//  - commit on pointerup through the caller's onCommit (→ dragCommit)
//  - Esc / pointercancel cancels; the click after a real drag is suppressed
//    so tap-swap (the primary path) never double-fires.
//
// Drop targets are discovered by data attribute inside the board container:
//   [data-drop-slot="<slotKey>"], [data-drop-bench="<playerId>"],
//   [data-drop-bench-area] — ordered most-specific first for hitTest.

export interface ActiveDrag {
  source: Selection;
  playerId: number;
  hoverTarget: DropTarget | null;
}

interface Arm {
  source: Selection;
  playerId: number;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  startedAt: number;
}

interface Options {
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onCommit: (source: Selection, target: DropTarget | null) => void;
  onCancel?: () => void;
}

export function useLineupDrag({ enabled, containerRef, onCommit, onCancel }: Options) {
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const armRef = useRef<Arm | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const rectsRef = useRef<TargetRect<DropTarget>[]>([]);
  const ghostElRef = useRef<HTMLDivElement | null>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const setDragBoth = (next: ActiveDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const paintGhost = useCallback(() => {
    rafRef.current = null;
    const el = ghostElRef.current;
    if (el) {
      const { x, y } = pointerPosRef.current;
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, []);

  const scheduleGhost = useCallback(() => {
    if (rafRef.current == null) rafRef.current = window.requestAnimationFrame(paintGhost);
  }, [paintGhost]);

  const collectRects = useCallback((): TargetRect<DropTarget>[] => {
    const root = containerRef.current;
    if (!root) return [];
    const rects: TargetRect<DropTarget>[] = [];
    const push = (el: Element, target: DropTarget) => {
      const r = el.getBoundingClientRect();
      rects.push({ target, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    };
    root.querySelectorAll('[data-drop-slot]').forEach(el =>
      push(el, { kind: 'slot', key: (el as HTMLElement).dataset.dropSlot! }));
    root.querySelectorAll('[data-drop-bench]').forEach(el =>
      push(el, { kind: 'bench', playerId: Number((el as HTMLElement).dataset.dropBench) }));
    root.querySelectorAll('[data-drop-bench-area]').forEach(el =>
      push(el, { kind: 'benchArea' }));
    return rects;
  }, [containerRef]);

  const beginDrag = useCallback((arm: Arm) => {
    clearHoldTimer();
    armRef.current = null;
    rectsRef.current = collectRects();
    setDragBoth({ source: arm.source, playerId: arm.playerId, hoverTarget: null });
    scheduleGhost();
  }, [collectRects, scheduleGhost]);

  const finish = useCallback((commit: boolean) => {
    clearHoldTimer();
    armRef.current = null;
    const active = dragRef.current;
    if (active) {
      suppressClickRef.current = true; // the click right after a real drag is not a tap
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      if (commit) onCommit(active.source, active.hoverTarget);
      else onCancel?.();
    }
    setDragBoth(null);
    rectsRef.current = [];
  }, [onCommit, onCancel]);

  // Global listeners live for the whole armed/dragging window.
  useEffect(() => {
    if (!enabled) return;

    const onPointerMove = (e: PointerEvent) => {
      pointerPosRef.current = { x: e.clientX, y: e.clientY };
      const arm = armRef.current;
      if (arm && e.pointerId === arm.pointerId) {
        const dist = Math.hypot(e.clientX - arm.startX, e.clientY - arm.startY);
        const decision = dragArmDecision(arm.pointerType, dist, Date.now() - arm.startedAt);
        if (decision === 'begin') beginDrag(arm);
        else if (decision === 'cancel') { clearHoldTimer(); armRef.current = null; }
        return;
      }
      const active = dragRef.current;
      if (active) {
        scheduleGhost();
        const target = hitTest(e.clientX, e.clientY, rectsRef.current);
        if (!sameDropTarget(target, active.hoverTarget)) setDragBoth({ ...active, hoverTarget: target });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const arm = armRef.current;
      if (arm && e.pointerId === arm.pointerId) { clearHoldTimer(); armRef.current = null; }
      if (dragRef.current) finish(true);
    };

    const onPointerCancel = () => {
      clearHoldTimer();
      armRef.current = null;
      if (dragRef.current) finish(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) {
        e.stopPropagation(); // don't also clear the tap-swap selection
        finish(false);
      }
    };

    // Non-passive: once a drag is LIVE we own the gesture and stop scrolling.
    // While merely armed we do nothing, so pans/scrolls proceed and the browser
    // fires pointercancel, which cancels the arm — scroll wins by design.
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('touchmove', onTouchMove);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, beginDrag, finish, scheduleGhost]);

  // Leaving edit mode mid-drag (save from keyboard, roster refetch…) cleans up.
  useEffect(() => {
    if (!enabled) {
      clearHoldTimer();
      armRef.current = null;
      setDragBoth(null);
    }
  }, [enabled]);

  /** Attach to a draggable card's onPointerDown (edit mode only). */
  const armDrag = useCallback((e: React.PointerEvent, source: Selection, playerId: number) => {
    if (!enabled || dragRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
    const arm: Arm = {
      source, playerId,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      startedAt: Date.now(),
    };
    armRef.current = arm;
    if (e.pointerType !== 'mouse') {
      clearHoldTimer();
      holdTimerRef.current = window.setTimeout(() => {
        if (armRef.current === arm) beginDrag(arm);
      }, TOUCH_HOLD_MS);
    }
  }, [enabled, beginDrag]);

  /** True exactly once, for the click event that follows a completed drag. */
  const consumeClickSuppression = useCallback(() => {
    const suppressed = suppressClickRef.current;
    suppressClickRef.current = false;
    return suppressed;
  }, []);

  return { drag, ghostElRef, armDrag, consumeClickSuppression };
}
