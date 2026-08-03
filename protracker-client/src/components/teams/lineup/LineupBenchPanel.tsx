import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { PlayerAvatar } from '../../players/PlayerAvatar';
import { PlayerStatusBadge } from '../../players/PlayerStatusBadge';
import { RatingChip } from './LineupPlayerCard';
import { positionAbbr } from './lineupLayouts';
import type { Selection } from './lineupEditLogic';
import type { ActiveDrag } from './useLineupDrag';
import type { LineupPlayer } from './lineupLogic';
import type { Player } from '../../../types';

interface Props {
  benchPlayers: LineupPlayer[];
  playerById: Map<number, Player>;
  editing: boolean;
  panelCollapsed: boolean;
  onToggleCollapsed: () => void;
  selection: Selection | null;
  drag: ActiveDrag | null;
  injuredIds: Set<number>;
  failedIds: Set<number>;
  isMobile: boolean;
  hoverId: number | null;
  onHoverChange: (id: number | null) => void;
  onTap: (target: Selection, playerId: number) => void;
  onArmDrag?: (e: React.PointerEvent, source: Selection, playerId: number) => void;
  renderPopover: (id: number) => React.ReactNode;
}

// Bench — in edit mode every unplaced roster player is placeable. JSX extracted
// verbatim from LineupBoard (Phase 9 §2c); the data-drop-bench/-area attributes
// are the drag hook's hit targets and must stay exactly as they are.
export function LineupBenchPanel({
  benchPlayers, playerById, editing, panelCollapsed, onToggleCollapsed, selection, drag,
  injuredIds, failedIds, isMobile, hoverId, onHoverChange, onTap, onArmDrag, renderPopover,
}: Props) {
  const { t } = useTranslation();
  if (benchPlayers.length === 0) return null;
  const benchAreaHover = drag?.hoverTarget?.kind === 'benchArea';

  return (
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
            onClick={onToggleCollapsed}
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
                onClick={() => onTap({ kind: 'bench', playerId: lp.id }, lp.id)}
                onPointerDown={editing && onArmDrag ? e => onArmDrag(e, { kind: 'bench', playerId: lp.id }, lp.id) : undefined}
                onMouseEnter={() => onHoverChange(lp.id)}
                onMouseLeave={() => onHoverChange(null)}
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
                  {renderPopover(lp.id)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
