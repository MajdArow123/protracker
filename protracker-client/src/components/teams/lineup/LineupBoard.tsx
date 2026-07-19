import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  AlertTriangle, ChevronDown, ChevronUp, FlaskConical, HeartPulse, Pencil, Redo2, RotateCcw, Save, Trash2, Undo2, X,
} from 'lucide-react';
import { useIsMobile, useMediaQuery } from '../../../hooks/useMediaQuery';
import { useIsRtl } from '../../../hooks/useIsRtl';
import { useLocaleFormat } from '../../../hooks/useLocaleFormat';
import { useTeamMatches } from '../../../hooks/useMatches';
import { useLineup, useSaveLineup, useResetLineup } from '../../../hooks/useLineup';
import { useToast } from '../../../context/ToastContext';
import { ConfirmModal } from '../../ui/Modal';
import { Skeleton } from '../../ui/Skeleton';
import { PlayerAvatar } from '../../players/PlayerAvatar';
import { PlayerStatusBadge } from '../../players/PlayerStatusBadge';
import { SportSurface } from './PitchSurface';
import { LineupPlayerCard, RatingChip } from './LineupPlayerCard';
import { StatPopover } from './StatPopover';
import { SaveLineupModal } from './SaveLineupModal';
import { PlayerInspectorPanel } from './PlayerInspector';
import { InspectorSheet } from './InspectorSheet';
import { DragGhost } from './DragGhost';
import { FormationPreview } from './FormationPreview';
import { layoutForSport, positionAbbr } from './lineupLayouts';
import { formationsForSport, formationOrDefault, type FormationDef } from './lineupFormations';
import {
  suggestedAssignments, hydrateAssignments, remapFormation, formationChangeSummary,
  validateLineup, sameLineup, type Assignments, type Selection,
} from './lineupEditLogic';
import {
  emptyTactical, hydrateTactical, pruneTactical, sameTactical, buildSaveInput,
  hasTacticalContent, positionFit, slotKeysOf, type TacticalState,
} from './lineupTacticalLogic';
import { fitMatrix, explainSuggestion, type SlotExplanation } from './lineupFitLogic';
import { FitChip } from './FitChip';
import { WhyPicksPanel } from './WhyPicksPanel';
import { TacticsPanel, TacticsSummary, type XiEntry } from './TacticsPanel';
import { dragCommit, type DropTarget } from './lineupDragLogic';
import { draftReducer, canUndo, canRedo } from './lineupDraftReducer';
import { useLineupDrag } from './useLineupDrag';
import { categoryBreakdown, compareByRating, type LineupPlayer } from './lineupLogic';
import type { EvidenceBasedScore, Player } from '../../../types';

interface Props {
  teamId: number;
  sportId: number;
  players: Player[];
  lineupPlayers: LineupPlayer[];
  scoresById: Map<number, EvidenceBasedScore[]>;
  failedIds: Set<number>;
  injuredIds: Set<number>;
  canManage: boolean;
}

// The editable lineup workspace: context selector (default XI / match),
// formation picker with previews + apply-summary, tap-swap + keyboard editing
// (the primary path), pointer drag as enhancement (commits ONLY through
// moveOrSwap via dragCommit — release outside cancels, never drops), undo/redo
// history, save/attach chooser, reset. Honesty carries throughout: rating
// chips render identically in edit mode.
export function LineupBoard({
  teamId, sportId, players, lineupPlayers, scoresById, failedIds, injuredIds, canManage,
}: Props) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormat();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isRtl = useIsRtl();

  const layout = layoutForSport(sportId)!;
  const formations = formationsForSport(sportId);

  // Which lineup is on screen: null = team default, number = that match's.
  const [matchContext, setMatchContext] = useState<number | null>(null);
  const savedQuery = useLineup(teamId, matchContext);
  const { data: matches = [] } = useTeamMatches(teamId);
  const saveMutation = useSaveLineup(teamId);
  const resetMutation = useResetLineup(teamId);

  // Draft + undo/redo history. null = not editing (view mode).
  const [history, dispatch] = useReducer(draftReducer, null);
  const editing = history != null;
  const draft = history?.present ?? null;

  const [selection, setSelection] = useState<Selection | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [inspectorId, setInspectorId] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<null | (() => void)>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // Phase 4: explanations attach ONLY to the suggestion that produced them —
  // rendered while the draft still matches that snapshot, hidden the moment it
  // diverges (undo back to the snapshot honestly re-shows them).
  const [whyPicks, setWhyPicks] = useState<null | {
    formationKey: string;
    assignments: Assignments;
    explanations: SlotExplanation[];
  }>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const inspectorInvokerRef = useRef<HTMLElement | null>(null);
  const isLgUp = useMediaQuery('(min-width: 1024px)');

  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const lineupById = useMemo(() => new Map(lineupPlayers.map(p => [p.id, p])), [lineupPlayers]);
  const rosterIds = useMemo(() => new Set(players.map(p => p.id)), [players]);
  const nameOf = useCallback((id?: number | null) =>
    (id != null ? playerById.get(id)?.fullName ?? '' : ''), [playerById]);

  // Baseline = what view mode shows and what editing starts from: the saved
  // lineup hydrated against the LIVE roster, else the suggested auto-arrange.
  const saved = savedQuery.data ?? null;
  const baseline = useMemo(() => {
    const formation = formationOrDefault(sportId, saved?.formation)!;
    const assignments = saved
      ? hydrateAssignments(saved, formation, rosterIds)
      : suggestedAssignments(lineupPlayers, formation);
    // Tactical state hydrates with the same roster-keyed drop as slots
    // (captain/vice/takers off the live roster fall to empty, never ghosts).
    const tactical = saved ? hydrateTactical(saved, assignments, rosterIds) : emptyTactical();
    return { formationKey: formation.key, assignments, tactical };
  }, [saved, sportId, rosterIds, lineupPlayers]);

  const current = draft ?? baseline;
  const formation: FormationDef = formationOrDefault(sportId, current.formationKey)!;
  const dirty = editing && draft != null
    && (!sameLineup(draft.formationKey, draft.assignments, baseline.formationKey, baseline.assignments)
      || !sameTactical(draft.tactical, baseline.tactical));

  const benchPlayers = useMemo(() => {
    const placed = new Set(Object.values(current.assignments));
    return lineupPlayers.filter(p => !placed.has(p.id)).sort(compareByRating);
  }, [lineupPlayers, current.assignments]);

  // Phase 4: per-player-per-slot fit, recomputed only on roster/formation change.
  const fits = useMemo(() => fitMatrix(players, formation), [players, formation]);
  const fitnessNullIds = useMemo(
    () => new Set(players.filter(p => p.fitnessLevel == null).map(p => p.id)),
    [players],
  );

  // ── Commit path (shared by tap-swap AND drag — the equivalence is by construction) ──

  const announceMove = useCallback((before: Assignments, source: Selection, target: DropTarget) => {
    const sourceId = source.kind === 'slot' ? before[source.key] : source.playerId;
    if (target.kind === 'benchArea') {
      if (sourceId != null) setAnnouncement(t('teams.lineupBenchAnnounce', '{{player}} sent to the bench', { player: nameOf(sourceId) }));
      return;
    }
    if (target.kind === 'slot') {
      const occupant = before[target.key];
      if (sourceId != null && occupant != null && occupant !== sourceId) {
        setAnnouncement(t('teams.lineupSwapAnnounce', '{{a}} and {{b}} swapped', { a: nameOf(sourceId), b: nameOf(occupant) }));
      } else if (sourceId != null) {
        setAnnouncement(t('teams.lineupMoveAnnounce', '{{player}} moved to {{slot}}', { player: nameOf(sourceId), slot: target.key }));
      } else if (occupant != null && source.kind === 'slot') {
        setAnnouncement(t('teams.lineupMoveAnnounce', '{{player}} moved to {{slot}}', { player: nameOf(occupant), slot: source.key }));
      }
      return;
    }
    if (sourceId != null) {
      setAnnouncement(t('teams.lineupSwapAnnounce', '{{a}} and {{b}} swapped', { a: nameOf(sourceId), b: nameOf(target.playerId) }));
    }
  }, [t, nameOf]);

  const commitMove = useCallback((source: Selection, target: DropTarget) => {
    if (!draft) return;
    const before = draft.assignments;
    const after = dragCommit(before, source, target);
    if (sameLineup(draft.formationKey, before, draft.formationKey, after)) return;
    const fdef = formationOrDefault(sportId, draft.formationKey)!;
    // Every assignments change re-establishes the tactical invariants
    // (captain/vice/takers ∈ XI; roles only on occupied slots).
    const tactical = pruneTactical(draft.tactical, after, slotKeysOf(fdef));
    dispatch({ type: 'apply', draft: { formationKey: draft.formationKey, assignments: after, tactical } });
    announceMove(before, source, target);
  }, [draft, sportId, announceMove]);

  // ── Drag (pointer enhancement over the same commit path) ─────────────────────

  const { drag, ghostElRef, armDrag, consumeClickSuppression } = useLineupDrag({
    enabled: editing,
    containerRef: boardRef,
    onCommit: (source, target) => {
      if (target == null) {
        setAnnouncement(t('teams.lineupDragCancelled', 'Move cancelled'));
        return; // released outside every target — nothing changes, never drops
      }
      commitMove(source, target);
      setSelection(null);
    },
    onCancel: () => setAnnouncement(t('teams.lineupDragCancelled', 'Move cancelled')),
  });
  const dragPlayer = drag ? playerById.get(drag.playerId) : undefined;

  // ── Edit lifecycle ───────────────────────────────────────────────────────────

  // ── Inspector (view mode only, per ruling) ───────────────────────────────────

  const openInspector = (playerId: number) => {
    inspectorInvokerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setInspectorId(playerId);
  };

  const closeInspector = useCallback(() => {
    setInspectorId(null);
    inspectorInvokerRef.current?.focus();
    inspectorInvokerRef.current = null;
  }, []);

  // Esc closes the desktop panel (the mobile sheet inherits Modal's own Esc).
  useEffect(() => {
    if (editing || inspectorId == null || !isLgUp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInspector();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, inspectorId, isLgUp, closeInspector]);

  const startEdit = () => {
    closeInspector();
    dispatch({
      type: 'begin',
      draft: {
        formationKey: baseline.formationKey,
        assignments: { ...baseline.assignments },
        tactical: {
          ...baseline.tactical,
          labels: [...baseline.tactical.labels],
          roles: { ...baseline.tactical.roles },
          setPieces: { ...baseline.tactical.setPieces },
        },
      },
    });
    setSelection(null);
  };

  const stopEdit = useCallback(() => {
    dispatch({ type: 'end' });
    setSelection(null);
    setWhyPicks(null);
  }, []);

  const guardDirty = (action: () => void) => {
    if (dirty) setConfirmDiscard(() => action);
    else action();
  };

  const switchContext = (next: number | null) => {
    guardDirty(() => {
      stopEdit();
      setMatchContext(next);
    });
  };

  const doUndo = useCallback(() => {
    if (!canUndo(history)) return;
    dispatch({ type: 'undo' });
    setSelection(null);
    setAnnouncement(t('teams.lineupUndone', 'Undone'));
  }, [history, t]);

  const doRedo = useCallback(() => {
    if (!canRedo(history)) return;
    dispatch({ type: 'redo' });
    setSelection(null);
    setAnnouncement(t('teams.lineupRedone', 'Redone'));
  }, [history, t]);

  const changeFormation = (key: string) => {
    if (!draft) return;
    const from = formationOrDefault(sportId, draft.formationKey)!;
    const to = formationOrDefault(sportId, key)!;
    if (from.key === to.key) return;
    const summary = formationChangeSummary(draft.assignments, from, to);
    const remapped = remapFormation(draft.assignments, from, to);
    const tactical = pruneTactical(draft.tactical, remapped, slotKeysOf(to));
    dispatch({ type: 'apply', draft: { formationKey: to.key, assignments: remapped, tactical } });
    setSelection(null);
    const names = summary.benched.map(id => nameOf(id)).filter(Boolean);
    const msg = names.length === 0
      ? t('teams.lineupFormationApplied', '{{formation}} applied', { formation: to.key })
      : names.length <= 3
        ? t('teams.lineupFormationBenchedNames', '{{formation}} applied — {{names}} moved to the bench', { formation: to.key, names: names.join(', ') })
        : t('teams.lineupFormationBenchedCount', '{{formation}} applied — {{count}} players moved to the bench', { formation: to.key, count: names.length });
    addToast(msg, 'info');
    setAnnouncement(msg);
  };

  const resetToSuggested = () => {
    if (!draft) return;
    const def = formationOrDefault(sportId, draft.formationKey)!;
    // Identical arrangement to suggestedAssignments (pinned by test) plus the
    // per-pick explanations of what the engine actually did.
    const { assignments: suggested, explanations } = explainSuggestion(lineupPlayers, def, {
      injuredIds,
      fitnessNullIds,
    });
    // Coach-authored tactical data survives the re-arrange where still valid.
    const tactical = pruneTactical(draft.tactical, suggested, slotKeysOf(def));
    dispatch({ type: 'apply', draft: { formationKey: def.key, assignments: suggested, tactical } });
    setWhyPicks({ formationKey: def.key, assignments: suggested, explanations });
    setSelection(null);
    setAnnouncement(t('teams.lineupResetSuggested', 'Reset to suggested XI'));
  };

  // Tactical edits (captain/vice/role/set-piece/label/notes) share the same
  // reducer path — each commit is one undo step; prune keeps invariants.
  const applyTactical = useCallback((mutate: (prev: TacticalState) => TacticalState) => {
    if (!draft) return;
    const tactical = pruneTactical(
      mutate(draft.tactical),
      draft.assignments,
      slotKeysOf(formationOrDefault(sportId, draft.formationKey)!),
    );
    dispatch({ type: 'apply', draft: { ...draft, tactical } });
  }, [draft, sportId]);

  // Keyboard: Esc clears the selection; Cmd/Ctrl+Z / +Shift+Z undo/redo.
  // (The drag hook's capture-phase Esc handler wins during a live drag.)
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'Escape') {
        setSelection(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo(); else doUndo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, doUndo, doRedo]);

  // One tap model for slots and bench, everywhere: first tap selects, second
  // tap applies (swap/move/place) or reselects. Buttons make it keyboardable.
  const editTap = (target: Selection) => {
    if (!draft) return;
    if (!selection) {
      setSelection(target);
      return;
    }
    if (selection.kind === target.kind
      && ((selection.kind === 'slot' && (selection as { key: string }).key === (target as { key: string }).key)
        || (selection.kind === 'bench' && (selection as { playerId: number }).playerId === (target as { playerId: number }).playerId))) {
      setSelection(null); // tap the selection again to deselect
      return;
    }
    if (selection.kind === 'bench' && target.kind === 'bench') {
      setSelection(target); // reselect a different bench player
      return;
    }
    commitMove(selection, target);
    setSelection(null);
  };

  // View mode: open the inspector (desktop panel / mobile-tablet sheet). The
  // old navigate-away lives inside the inspector as "Open full profile".
  const viewTap = (playerId: number) => {
    openInspector(playerId);
  };

  // Shared tap entry: swallows the synthetic click that follows a real drag.
  const tap = (target: Selection, playerId?: number) => {
    if (consumeClickSuppression()) return;
    if (editing) editTap(target);
    else if (playerId != null) viewTap(playerId);
  };

  const doSave = (matchId: number | null) => {
    if (!draft) return;
    const errors = validateLineup(draft.assignments, formation, rosterIds);
    if (errors.length > 0) {
      addToast(t('teams.lineupInvalid', 'This lineup has invalid entries.'), 'error');
      return;
    }
    saveMutation.mutate(
      // buildSaveInput is the write-through contract: EVERY tactical field is
      // always in the payload (the server clears whatever is omitted).
      buildSaveInput(matchId, draft.formationKey, draft.assignments, draft.tactical),
      {
        onSuccess: () => {
          setSaveOpen(false);
          stopEdit();
          setMatchContext(matchId);
          addToast(t('teams.lineupSaved', 'Lineup saved'), 'success');
        },
        onError: err => addToast(err instanceof Error ? err.message : t('teams.lineupSaveFailed', 'Could not save the lineup'), 'error'),
      },
    );
  };

  const doReset = () => {
    resetMutation.mutate(matchContext, {
      onSuccess: () => {
        setConfirmReset(false);
        addToast(t('teams.lineupResetDone', 'Back to the suggested lineup'), 'success');
      },
      onError: err => addToast(err instanceof Error ? err.message : t('teams.lineupSaveFailed', 'Could not save the lineup'), 'error'),
    });
  };

  const matchLabel = (mId: number) => {
    const m = matches.find(x => x.id === mId);
    return m
      ? `${t('teams.lineupVs', 'vs')} ${m.opponentName} · ${formatDate(m.matchDate, { month: 'short', day: 'numeric' })}`
      : `#${mId}`;
  };

  const renderPopoverBody = (id: number, showProfileButton: boolean) => {
    const p = playerById.get(id);
    if (!p) return null;
    return (
      <StatPopover
        player={p}
        rating={lineupById.get(id)?.rating ?? { kind: 'none' }}
        breakdown={categoryBreakdown(scoresById.get(id) ?? [])}
        injured={injuredIds.has(id)}
        onViewProfile={() => navigate(`/players/${id}?tab=evidence`)}
        showProfileButton={showProfileButton}
      />
    );
  };

  if (savedQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-md">
        <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: layout.aspect }} />
      </div>
    );
  }

  const hoverSlot = !isMobile && hoverId != null
    ? formation.slots.find(s => current.assignments[s.key] === hoverId) ?? null
    : null;
  const selectedSlotOccupied = selection?.kind === 'slot' && current.assignments[selection.key] != null;
  const benchAreaHover = drag?.hoverTarget?.kind === 'benchArea';

  // Phase 4: while a player is selected or dragged, other slots wear their fit
  // for THAT player (icon + text, never color alone). Pure read — tap/drag
  // behavior is untouched.
  const activePlayerId = editing
    ? drag
      ? drag.playerId
      : selection
        ? selection.kind === 'bench'
          ? selection.playerId
          : current.assignments[selection.key] ?? null
        : null
    : null;

  // XI list for the tactics panel, in the formation's slot order.
  const xiEntries: XiEntry[] = formation.slots
    .filter(slot => current.assignments[slot.key] != null)
    .map(slot => ({
      playerId: current.assignments[slot.key],
      name: nameOf(current.assignments[slot.key]),
      slotKey: slot.key,
      slotAbbr: slot.key,
    }));

  const inspectorPlayer = !editing && inspectorId != null ? playerById.get(inspectorId) : undefined;
  const inspectorBody = inspectorPlayer
    ? {
        player: inspectorPlayer,
        rating: lineupById.get(inspectorPlayer.id)?.rating ?? ({ kind: 'none' } as const),
        loadFailed: failedIds.has(inspectorPlayer.id),
        breakdown: categoryBreakdown(scoresById.get(inspectorPlayer.id) ?? []),
        injured: injuredIds.has(inspectorPlayer.id),
        open: true,
        onOpenProfile: () => navigate(`/players/${inspectorPlayer.id}?tab=evidence`),
      }
    : null;

  const benchSection = benchPlayers.length > 0 && (
    <div
      data-drop-bench-area
      className={clsx(
        'mt-5 rounded-xl transition-shadow',
        editing && 'lg:mt-0 lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-14',
        benchAreaHover && 'ring-2 ring-emerald-400',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
          {t('teams.lineupBench', 'Bench')} <span className="text-gray-400 font-medium">({benchPlayers.length})</span>
        </h4>
        {editing && (
          <button
            type="button"
            onClick={() => setPanelCollapsed(c => !c)}
            aria-expanded={!panelCollapsed}
            aria-label={panelCollapsed ? t('teams.lineupExpandBench', 'Expand bench panel') : t('teams.lineupCollapseBench', 'Collapse bench panel')}
            className="hidden lg:inline-flex p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            {panelCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        )}
      </div>
      <div
        className={clsx(
          'flex sm:grid sm:grid-cols-2 gap-2 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0',
          editing ? 'lg:grid-cols-1' : 'lg:grid-cols-3',
          editing && panelCollapsed && 'lg:hidden',
        )}
      >
        {benchPlayers.map(lp => {
          const p = playerById.get(lp.id);
          if (!p) return null;
          const isSelected = selection?.kind === 'bench' && selection.playerId === lp.id;
          const isDropTarget = drag?.hoverTarget?.kind === 'bench' && drag.hoverTarget.playerId === lp.id;
          const isDragSource = drag?.source.kind === 'bench' && drag.source.playerId === lp.id;
          return (
            <div key={lp.id} data-drop-bench={lp.id} className="relative min-w-[72%] sm:min-w-0 snap-start">
              <button
                type="button"
                onClick={() => tap({ kind: 'bench', playerId: lp.id }, lp.id)}
                onPointerDown={editing ? e => armDrag(e, { kind: 'bench', playerId: lp.id }, lp.id) : undefined}
                onMouseEnter={() => setHoverId(lp.id)}
                onMouseLeave={() => setHoverId(null)}
                aria-pressed={isSelected}
                className={clsx(
                  'w-full flex items-center gap-2.5 p-2.5 rounded-xl transition-colors cursor-pointer text-start',
                  isDragSource && 'opacity-40',
                  isDropTarget
                    ? 'bg-emerald-500/15 ring-2 ring-emerald-400'
                    : isSelected
                      ? 'bg-indigo-500/15 ring-2 ring-indigo-400'
                      : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}
              >
                <PlayerAvatar name={p.fullName} imageUrl={p.profileImageUrl} sportId={p.sportId} size={34} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                    {p.jerseyNumber != null && <span className="text-indigo-500 font-black">#{p.jerseyNumber}</span>}
                    <span className="truncate">{p.fullName}</span>
                    {injuredIds.has(p.id) && <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    {positionAbbr(p.positionId, t)}
                    {p.status && p.status !== 'Active' && <PlayerStatusBadge status={p.status} />}
                  </p>
                </div>
                <RatingChip rating={lp.rating} loadFailed={failedIds.has(lp.id)} />
              </button>
              {!isMobile && !editing && hoverId === lp.id && (
                <div className="absolute bottom-full mb-2 start-0 z-30 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 pointer-events-none">
                  {renderPopoverBody(lp.id, false)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={boardRef}>
      {/* A11y: every commit (tap, drag, undo/redo, formation) is announced. */}
      <div aria-live="polite" role="status" className="sr-only">{announcement}</div>

      {/* Context + action bar (sticky while editing — the workspace shell) */}
      <div
        className={clsx(
          'flex flex-wrap items-center justify-between gap-2 mb-3',
          editing && 'sticky top-0 z-20 py-2 -mx-2 px-2 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm',
        )}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="relative">
            <select
              value={matchContext ?? ''}
              onChange={e => switchContext(e.target.value ? Number(e.target.value) : null)}
              className="appearance-none ps-3 pe-8 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white cursor-pointer"
              aria-label={t('teams.lineupContext', 'Lineup for')}
            >
              <option value="">{t('teams.lineupDefaultXi', 'Default XI')}</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>{matchLabel(m.id)}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
            {formation.key}
          </span>
          {saved ? (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('teams.lineupSavedMeta', 'Saved · {{date}}', { date: formatDate(saved.updatedAt, { month: 'short', day: 'numeric' }) })}
            </span>
          ) : (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {t('teams.lineupSuggestedMeta', 'Suggested — auto-arranged by rating, not saved')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setOverlay(o => !o)}
              aria-pressed={overlay}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                overlay
                  ? 'bg-rose-500/10 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              <HeartPulse size={13} /> {t('teams.lineupSquadHealth', 'Squad health')}
            </button>
          )}
          {canManage && !editing && (
            <>
              {saved && (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} /> {t('teams.lineupResetSaved', 'Remove saved')}
                </button>
              )}
              <button
                type="button"
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Pencil size={13} /> {t('teams.lineupEdit', 'Edit lineup')}
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={doUndo}
                disabled={!canUndo(history)}
                title={`${t('teams.lineupUndo', 'Undo')} (Ctrl+Z)`}
                aria-label={t('teams.lineupUndo', 'Undo')}
                className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Undo2 size={13} />
              </button>
              <button
                type="button"
                onClick={doRedo}
                disabled={!canRedo(history)}
                title={`${t('teams.lineupRedo', 'Redo')} (Ctrl+Shift+Z)`}
                aria-label={t('teams.lineupRedo', 'Redo')}
                className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Redo2 size={13} />
              </button>
              <button
                type="button"
                onClick={resetToSuggested}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} /> {t('teams.lineupResetSuggested', 'Reset to suggested XI')}
              </button>
              <button
                type="button"
                onClick={() => guardDirty(stopEdit)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <X size={13} /> {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => setSaveOpen(true)}
                disabled={saveMutation.isPending}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Save size={13} /> {t('common.save', 'Save')}
                {dirty && <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white dark:border-gray-900" aria-label={t('teams.lineupUnsaved', 'Unsaved changes')} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Formation picker with miniature previews (single-formation sports get none) */}
      {editing && formations.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-3" role="radiogroup" aria-label={t('teams.lineupFormation', 'Formation')}>
          {formations.map(f => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={current.formationKey === f.key}
              onClick={() => changeFormation(f.key)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer',
                current.formationKey === f.key
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400',
              )}
            >
              <FormationPreview formation={f} />
              {f.key}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/15 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300">
          <span>
            {selection
              ? t('teams.lineupPlaceHint', 'Now tap a slot or player to swap — Esc to cancel')
              : t('teams.lineupSelectHint', 'Tap a player or slot to select it (keyboard: Tab + Enter)')}
          </span>
          {selectedSlotOccupied && (
            <button type="button" onClick={() => { commitMove(selection as Selection, { kind: 'benchArea' }); setSelection(null); }} className="font-semibold underline cursor-pointer flex-shrink-0">
              {t('teams.lineupSendToBench', 'Send to bench')}
            </button>
          )}
        </div>
      )}

      {overlay && !editing && (
        <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full ring-2 ring-red-500" /> {t('teams.lineupLegendInjured', 'Injured')}
          </span>
          <span className="flex items-center gap-1.5">
            <FlaskConical size={12} className="text-amber-500" /> {t('teams.lineupLegendThin', 'Needs testing (thin data)')}
          </span>
        </div>
      )}

      {/* View mode with the inspector open: content column + panel. */}
      <div className={clsx(inspectorBody && isLgUp && 'lg:flex lg:items-start lg:gap-6')}>
      <div className="lg:flex-1 lg:min-w-0">
      {/* Workspace: pitch beside the bench panel while editing on desktop. */}
      <div className={clsx(editing && benchPlayers.length > 0 && 'lg:flex lg:flex-row-reverse lg:items-start lg:gap-6')}>
        <div className="lg:flex-1 lg:min-w-0">
          {/* The surface is a fixed spatial diagram — LTR by convention, like charts. */}
          <div
            dir="ltr"
            className={clsx('relative mx-auto w-full select-none', editing ? 'max-w-lg' : 'max-w-md')}
            style={{ aspectRatio: layout.aspect }}
          >
            <SportSurface sportId={sportId} />
            {formation.slots.map(slot => {
              const playerId = current.assignments[slot.key];
              const p = playerId != null ? playerById.get(playerId) : undefined;
              const lp = playerId != null ? lineupById.get(playerId) : undefined;
              const isSelected = selection?.kind === 'slot' && selection.key === slot.key;
              const isDropTarget = drag?.hoverTarget?.kind === 'slot' && drag.hoverTarget.key === slot.key;
              const isDragSource = drag?.source.kind === 'slot' && drag.source.key === slot.key;
              // Coach-entered secondary positions sharpen the OOP hint.
              const fit = editing && p ? positionFit(slot, p.positionId, p.secondaryPositionIds) : 'natural';
              return (
                <div
                  key={slot.key}
                  data-drop-slot={slot.key}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  {activePlayerId != null && playerId !== activePlayerId && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                      <FitChip fit={fits.get(activePlayerId)?.get(slot.key) ?? { category: 'cantAssess', footFact: null }} />
                    </span>
                  )}
                  {p && lp ? (
                    <LineupPlayerCard
                      player={p}
                      rating={lp.rating}
                      loadFailed={failedIds.has(p.id)}
                      injured={injuredIds.has(p.id)}
                      overlay={overlay && !editing}
                      accent={slot.accent}
                      selected={isSelected}
                      oop={fit === 'oop'}
                      secondaryFit={fit === 'secondary'}
                      captainMark={
                        current.tactical.captainId === p.id ? 'C'
                          : current.tactical.viceCaptainId === p.id ? 'VC'
                            : null
                      }
                      dropTarget={isDropTarget}
                      dimmed={isDragSource}
                      onActivate={() => tap({ kind: 'slot', key: slot.key }, p.id)}
                      onHoverChange={h => setHoverId(h ? p.id : null)}
                      onPointerDown={editing ? e => armDrag(e, { kind: 'slot', key: slot.key }, p.id) : undefined}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!editing}
                      onClick={() => tap({ kind: 'slot', key: slot.key })}
                      aria-pressed={isSelected}
                      aria-label={t('teams.lineupEmptySlot', 'Empty slot {{slot}}', { slot: slot.key })}
                      className={clsx(
                        'flex flex-col items-center gap-1 focus:outline-none',
                        editing ? 'cursor-pointer' : 'cursor-default',
                      )}
                    >
                      <span
                        className={clsx(
                          'w-11 h-11 rounded-full border-2 border-dashed flex items-center justify-center text-[10px] font-bold',
                          isDropTarget
                            ? 'border-emerald-300 bg-emerald-500/30 text-white ring-4 ring-emerald-400'
                            : isSelected
                              ? 'border-indigo-300 bg-indigo-500/30 text-white ring-4 ring-indigo-400'
                              : 'border-white/50 text-white/70',
                          editing && !isSelected && !isDropTarget && 'hover:border-white hover:text-white',
                        )}
                      >
                        {slot.key}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
            {hoverSlot && hoverId != null && !editing && (
              <div
                dir={isRtl ? 'rtl' : 'ltr'}
                className="absolute z-30 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 pointer-events-none"
                style={{
                  left: `${Math.min(72, Math.max(28, hoverSlot.x))}%`,
                  transform: 'translateX(-50%)',
                  ...(hoverSlot.y > 45
                    ? { bottom: `${100 - hoverSlot.y + 6}%` }
                    : { top: `${hoverSlot.y + 6}%` }),
                }}
              >
                {renderPopoverBody(hoverId, false)}
              </div>
            )}
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-2">
            {editing
              ? t('teams.lineupEditHint', 'Tap to select, drag to move — hold to drag on touch. Keyboard: Tab + Enter, Esc, Ctrl+Z')
              : isMobile
                ? t('teams.lineupHintMobile', 'Tap a player for their stat panel')
                : t('teams.lineupHintDesktop', 'Hover a player for stats · click to open their evidence profile')}
          </p>
        </div>

        {/* Bench — in edit mode every unplaced roster player is placeable */}
        {benchSection}
      </div>

      {/* Phase 4: "why these picks" — only while the draft still matches the
          suggestion it explains (never retro-fitted onto manual edits). */}
      {editing && draft && whyPicks
        && sameLineup(draft.formationKey, draft.assignments, whyPicks.formationKey, whyPicks.assignments) && (
        <WhyPicksPanel
          explanations={whyPicks.explanations}
          nameOf={nameOf}
          onClose={() => setWhyPicks(null)}
        />
      )}

      {/* Coach-authored tactical layer (Phase 3) */}
      {editing && draft && (
        <TacticsPanel
          sportId={sportId}
          xi={xiEntries}
          tactical={draft.tactical}
          onChange={applyTactical}
        />
      )}
      {!editing && saved && hasTacticalContent(baseline.tactical) && (
        <TacticsSummary sportId={sportId} tactical={baseline.tactical} nameOf={nameOf} />
      )}
      </div>

      {/* Player Inspector (view mode only): desktop inline panel… */}
      {inspectorBody && isLgUp && (
        <PlayerInspectorPanel {...inspectorBody} onClose={closeInspector} />
      )}
      </div>

      {/* …and the mobile/tablet drawer (reuses Modal's sheet mechanics). */}
      {inspectorBody && !isLgUp && (
        <InspectorSheet {...inspectorBody} isOpen onClose={closeInspector} />
      )}

      {/* Drag ghost (pointer enhancement — decorative only) */}
      {drag && dragPlayer && <DragGhost player={dragPlayer} ghostElRef={ghostElRef} />}

      <SaveLineupModal
        key={`${saveOpen}-${matchContext ?? 'default'}`}
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        matches={matches}
        initialMatchId={matchContext}
        saving={saveMutation.isPending}
        onSave={doSave}
      />

      <ConfirmModal
        isOpen={confirmDiscard != null}
        onClose={() => setConfirmDiscard(null)}
        onConfirm={() => { confirmDiscard?.(); setConfirmDiscard(null); }}
        title={t('teams.lineupDiscardTitle', 'Discard changes?')}
        message={t('teams.lineupDiscardMsg', 'Your unsaved lineup changes will be lost.')}
        confirmLabel={t('teams.lineupDiscard', 'Discard')}
      />

      <ConfirmModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={doReset}
        title={t('teams.lineupResetTitle', 'Remove saved lineup?')}
        message={t('teams.lineupResetMsg', 'The saved lineup is deleted and the suggested XI takes over.')}
        confirmLabel={t('teams.lineupResetConfirm', 'Remove')}
        isLoading={resetMutation.isPending}
      />
    </div>
  );
}
