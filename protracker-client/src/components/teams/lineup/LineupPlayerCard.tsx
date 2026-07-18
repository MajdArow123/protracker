import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { PlayerAvatar } from '../../players/PlayerAvatar';
import { scoreTone } from '../../charts/chartColors';
import { confidenceDotColor, confidenceLabel } from '../../evidence/evidenceUtils';
import { positionAbbr } from './lineupLayouts';
import type { RatingState } from './lineupLogic';
import type { Player } from '../../../types';

// The rating chip is the honesty ladder made visible:
//   confident → bold, score-band colored, confidence dot
//   medium    → normal weight, amber dot
//   thin      → muted gray + dashed border (never a bold authoritative number)
//   none      → an em-dash "no data" chip (never 0.0)
//   failed    → "?" — a load error is not the same claim as "no data"
export function RatingChip({ rating, loadFailed, className }: {
  rating: RatingState;
  loadFailed?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const base = 'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] leading-none bg-white/95 dark:bg-gray-900/95 shadow-sm';

  if (loadFailed) {
    return (
      <span className={clsx(base, 'text-gray-400 border border-gray-300 dark:border-gray-700', className)} title={t('teams.lineupRatingUnavailable', 'Rating unavailable')}>
        ?
      </span>
    );
  }
  if (rating.kind === 'none') {
    return (
      <span className={clsx(base, 'text-gray-400 border border-gray-200 dark:border-gray-700', className)} title={t('teams.lineupNoData', 'No data')}>
        —
      </span>
    );
  }

  const dot = <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: confidenceDotColor(rating.confidence) }} />;
  if (rating.kind === 'thin') {
    return (
      <span className={clsx(base, 'font-medium text-gray-500 dark:text-gray-400 border border-dashed border-gray-400 dark:border-gray-500', className)} title={t('teams.lineupThinData', 'Thin data — treat with caution')}>
        {rating.value.toFixed(1)} {dot}
      </span>
    );
  }

  const toneClass = { red: 'text-red-500', amber: 'text-amber-500', green: 'text-emerald-500' }[scoreTone(rating.value)];
  // Provenance, accessibly (Phase 0): the value is CALCULATED, and the title says
  // from what. Deliberately no visual change — the compact marker stays as-is.
  const sourceTitle = t('common.dataSource.ratingTitle', 'Calculated from {{count}} evidence metrics — {{confidence}} confidence', {
    count: rating.scoredMetrics,
    confidence: confidenceLabel(rating.confidence, t),
  });
  return (
    <span className={clsx(base, toneClass, rating.kind === 'confident' ? 'font-black' : 'font-semibold', 'border border-gray-200/60 dark:border-gray-700/60', className)} title={sourceTitle}>
      {rating.value.toFixed(1)} {dot}
    </span>
  );
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

interface Props {
  player: Player;
  rating: RatingState;
  loadFailed?: boolean;
  injured: boolean;
  /** Squad-health overlay on: injured = red ring, thin/no data = dashed amber ring + flask. */
  overlay: boolean;
  /** Visually distinct slot (volleyball Libero — inverted-jersey convention). Overlay rings take precedence. */
  accent?: boolean;
  /** Edit mode: this card is the active selection (tap-swap source). */
  selected?: boolean;
  /** Edit mode: the player's position isn't natural for this slot. */
  oop?: boolean;
  /** Edit mode: not natural, but one of the player's coach-entered SECONDARY positions is. */
  secondaryFit?: boolean;
  /** Coach-entered captaincy (Phase 3). */
  captainMark?: 'C' | 'VC' | null;
  /** Edit mode: a live drag is hovering this card as its drop target. */
  dropTarget?: boolean;
  /** Edit mode: this card is the source of the live drag (ghost carries it). */
  dimmed?: boolean;
  onActivate: () => void;
  onHoverChange?: (hovering: boolean) => void;
  /** Edit mode: arms the pointer drag (tap/keyboard stay the primary path). */
  onPointerDown?: (e: React.PointerEvent) => void;
}

// Compact on-pitch card. Rendered inside the dir="ltr" pitch container.
export function LineupPlayerCard({ player, rating, loadFailed, injured, overlay, accent, selected, oop, secondaryFit, captainMark, dropTarget, dimmed, onActivate, onHoverChange, onPointerDown }: Props) {
  const { t } = useTranslation();
  const needsTesting = !loadFailed && (rating.kind === 'none' || rating.kind === 'thin');
  const showOverlayInjured = overlay && injured;
  const showOverlayThin = overlay && !injured && needsTesting;

  return (
    <button
      type="button"
      onClick={onActivate}
      onPointerDown={onPointerDown}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={clsx(
        'flex flex-col items-center w-16 sm:w-[4.5rem] cursor-pointer group focus:outline-none',
        dimmed && 'opacity-40',
      )}
      aria-label={player.fullName}
      aria-pressed={selected}
    >
      <div className="relative">
        <div
          className={clsx(
            'rounded-full transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-white',
            dropTarget && 'ring-4 ring-emerald-400 scale-105',
            !dropTarget && selected && 'ring-4 ring-indigo-400 scale-105',
            !dropTarget && !selected && showOverlayInjured && 'ring-2 ring-red-500 ring-offset-1 ring-offset-transparent',
            !dropTarget && !selected && showOverlayThin && 'outline-dashed outline-2 outline-amber-400',
            !dropTarget && !selected && accent && !showOverlayInjured && !showOverlayThin && 'ring-2 ring-amber-300/90',
          )}
        >
          <PlayerAvatar name={player.fullName} imageUrl={player.profileImageUrl} sportId={player.sportId} size={44} />
        </div>
        <RatingChip rating={rating} loadFailed={loadFailed} className="absolute -top-1.5 -left-2.5" />
        {injured && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center" title={t('teams.lineupInjured', 'Injured')}>
            <AlertTriangle size={10} className="text-white" />
          </span>
        )}
        {overlay && !injured && needsTesting && (
          <span className="absolute -bottom-0.5 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center" title={t('teams.lineupNeedsTesting', 'Needs testing')}>
            <FlaskConical size={10} className="text-amber-950" />
          </span>
        )}
        {oop && (
          <span
            className="absolute -bottom-1 -left-1.5 px-1 rounded-full bg-amber-400/95 text-amber-950 text-[8px] font-black leading-3"
            title={t('teams.lineupOutOfPosition', 'Out of position')}
          >
            {t('teams.lineupOopShort', 'OOP')}
          </span>
        )}
        {!oop && secondaryFit && (
          <span
            className="absolute -bottom-1 -left-1.5 px-1 rounded-full bg-sky-400/95 text-sky-950 text-[8px] font-black leading-3"
            title={t('teams.lineupSecondaryFit', 'Secondary position')}
          >
            {t('teams.lineupSecShort', 'SEC')}
          </span>
        )}
        {captainMark && (
          <span
            className={clsx(
              'absolute -right-2 min-w-4 h-4 px-0.5 rounded-full bg-yellow-400 text-yellow-950 text-[8px] font-black flex items-center justify-center shadow-sm',
              injured ? 'top-3' : '-top-1.5', // the injured badge owns the corner
            )}
            title={captainMark === 'C' ? t('teams.lineupCaptain', 'Captain') : t('teams.lineupViceCaptain', 'Vice-captain')}
          >
            {captainMark}
          </span>
        )}
      </div>
      <span className="mt-1 text-[11px] font-semibold text-white truncate max-w-full" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
        {shortName(player.fullName)}
      </span>
      <span className={clsx('text-[9px] font-medium', accent ? 'text-amber-300' : 'text-white/75')} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
        {positionAbbr(player.positionId, t)}
        {player.jerseyNumber != null && ` · #${player.jerseyNumber}`}
      </span>
    </button>
  );
}
