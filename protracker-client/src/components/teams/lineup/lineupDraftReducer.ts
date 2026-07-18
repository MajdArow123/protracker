import { sameLineup, type Assignments } from './lineupEditLogic';
import { sameTactical, type TacticalState } from './lineupTacticalLogic';

// Pure undo/redo history for the lineup draft (Phase 1 of the lineup program).
// null state = not editing. Every user-visible mutation (tap-swap, drag commit,
// send-to-bench, formation change, reset-to-suggested, and since Phase 3 every
// tactical edit — captain/vice/role/set-piece/label toggle; notes commit on
// blur, one step per edit session, never per keystroke) is exactly one
// 'apply', so each is exactly one undo step. Exported and unit-tested
// (src/test/lineupDraftReducer.test.ts) — UI stays thin.

export interface Draft {
  formationKey: string;
  assignments: Assignments;
  tactical: TacticalState;
}

export interface DraftHistory {
  past: Draft[];
  present: Draft;
  future: Draft[];
}

/** Oldest steps drop off beyond this — a bound, not a feature surface. */
export const HISTORY_LIMIT = 50;

export type DraftAction =
  | { type: 'begin'; draft: Draft }
  | { type: 'apply'; draft: Draft }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'end' };

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    sameLineup(a.formationKey, a.assignments, b.formationKey, b.assignments) &&
    sameTactical(a.tactical, b.tactical)
  );
}

export function draftReducer(state: DraftHistory | null, action: DraftAction): DraftHistory | null {
  switch (action.type) {
    case 'begin':
      return { past: [], present: action.draft, future: [] };
    case 'end':
      return null;
    case 'apply': {
      if (!state) return state;
      if (sameDraft(state.present, action.draft)) return state; // no-op: don't pollute history
      const past = [...state.past, state.present].slice(-HISTORY_LIMIT);
      return { past, present: action.draft, future: [] };
    }
    case 'undo': {
      if (!state || state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (!state || state.future.length === 0) return state;
      const [present, ...future] = state.future;
      return { past: [...state.past, state.present], present, future };
    }
  }
}

export function canUndo(state: DraftHistory | null): boolean {
  return state != null && state.past.length > 0;
}

export function canRedo(state: DraftHistory | null): boolean {
  return state != null && state.future.length > 0;
}
