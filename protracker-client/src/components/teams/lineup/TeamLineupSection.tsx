import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueries } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { AlertTriangle, FlaskConical, HeartPulse, LayoutGrid, Users } from 'lucide-react';
import { evidenceApi } from '../../../api/evidenceApi';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useIsRtl } from '../../../hooks/useIsRtl';
import { useDynamicLabels } from '../../../i18n/dynamicLabels';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { PlayerAvatar } from '../../players/PlayerAvatar';
import { PlayerStatusBadge } from '../../players/PlayerStatusBadge';
import { SportSurface } from './PitchSurface';
import { LineupPlayerCard, RatingChip } from './LineupPlayerCard';
import { StatPopover } from './StatPopover';
import { layoutForSport, positionAbbr } from './lineupLayouts';
import {
  assignToSlots, buildLadder, categoryBreakdown, computeOverallRating, deriveFormation,
  MIN_METRICS_FOR_CONFIDENT_RATING, type LineupPlayer,
} from './lineupLogic';
import type { EvidenceBasedScore, Player } from '../../../types';

interface Props {
  sportId: number;
  sportName: string;
  players: Player[];
  injuredIds: Set<number>;
}

// Read-only lineup view (Phase 1): evidence-rated cards auto-arranged onto a
// sport surface. No editing, no persistence — the arrangement is derived and
// says so on screen.
export function TeamLineupSection({ sportId, sportName, players, injuredIds }: Props) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isRtl = useIsRtl();
  const [overlay, setOverlay] = useState(false);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [sheetId, setSheetId] = useState<number | null>(null);

  const layout = layoutForSport(sportId);

  // One evidence-scores query per roster player (same key as
  // usePlayerEvidenceScores, so caches are shared with the player pages).
  const queries = useQueries({
    queries: players.map(p => ({
      queryKey: ['evidence', 'scores', p.id],
      queryFn: () => evidenceApi.getEvidenceScores(p.id),
      staleTime: 60_000,
      enabled: layout != null,
    })),
  });

  const isLoading = layout != null && queries.some(q => q.isLoading);

  const { lineupPlayers, scoresById, failedIds } = useMemo(() => {
    const scoresById = new Map<number, EvidenceBasedScore[]>();
    const failedIds = new Set<number>();
    const lineupPlayers: LineupPlayer[] = players.map((p, i) => {
      const scores = queries[i]?.data ?? [];
      scoresById.set(p.id, scores);
      if (queries[i]?.isError) failedIds.add(p.id);
      return {
        id: p.id,
        name: p.fullName,
        positionId: p.positionId ?? null,
        status: p.status ?? 'Active',
        rating: computeOverallRating(scores),
      };
    });
    return { lineupPlayers, scoresById, failedIds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, queries.map(q => `${q.dataUpdatedAt}:${q.errorUpdatedAt}`).join(',')]);

  const isLadder = layout?.kind === 'ladder';
  const arrangement = useMemo(
    () => (layout && !isLadder ? assignToSlots(lineupPlayers, layout) : null),
    [lineupPlayers, layout, isLadder],
  );
  const ladder = useMemo(
    () => (isLadder ? buildLadder(lineupPlayers) : null),
    [lineupPlayers, isLadder],
  );
  const formation = layout && arrangement ? deriveFormation(arrangement.placed, layout) : null;

  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const ratingById = useMemo(() => new Map(lineupPlayers.map(p => [p.id, p.rating])), [lineupPlayers]);

  if (!layout) {
    return (
      <EmptyState
        icon={<LayoutGrid size={36} />}
        title={t('teams.lineupComingSoon', 'Lineup view coming soon')}
        description={t('teams.lineupComingSoonDesc', 'The {{sport}} lineup view is on its way.', { sport: L.sport(sportName) })}
      />
    );
  }

  if (players.length === 0) {
    return (
      <EmptyState
        icon={<Users size={36} />}
        title={t('players.noPlayers', 'No players yet')}
        description={t('teams.addPlayersToStart', 'Add players to this team to get started')}
      />
    );
  }

  if (isLoading || (!arrangement && !ladder)) {
    return (
      <div className="mx-auto w-full max-w-md">
        <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: isLadder ? '3 / 4' : layout.aspect }} />
      </div>
    );
  }

  const activate = (id: number) => {
    if (isMobile) setSheetId(id);
    else navigate(`/players/${id}?tab=evidence`);
  };
  const viewProfile = (id: number) => navigate(`/players/${id}?tab=evidence`);

  const hoverAnchor = !isMobile && hoverId != null && arrangement
    ? arrangement.placed.find(pp => pp.player.id === hoverId) ?? null
    : null;
  const sheetPlayer = sheetId != null ? playerById.get(sheetId) : undefined;

  const renderPopoverBody = (id: number, showProfileButton: boolean) => {
    const p = playerById.get(id);
    if (!p) return null;
    return (
      <StatPopover
        player={p}
        rating={ratingById.get(id) ?? { kind: 'none' }}
        breakdown={categoryBreakdown(scoresById.get(id) ?? [])}
        injured={injuredIds.has(id)}
        onViewProfile={() => viewProfile(id)}
        showProfileButton={showProfileButton}
      />
    );
  };

  const benchRow = (lp: LineupPlayer, extra?: ReactNode, rank?: number) => {
    const p = playerById.get(lp.id);
    if (!p) return null;
    const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-gray-400';
    return (
      <div key={lp.id} className="relative min-w-[72%] sm:min-w-0 snap-start">
        <button
          type="button"
          onClick={() => activate(lp.id)}
          onMouseEnter={() => setHoverId(lp.id)}
          onMouseLeave={() => setHoverId(null)}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-start"
        >
          {rank != null && (
            <span className={clsx('w-6 text-center text-sm font-black flex-shrink-0', rankColor)}>{rank}</span>
          )}
          <PlayerAvatar name={p.fullName} imageUrl={p.profileImageUrl} sportId={p.sportId} size={34} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
              {p.jerseyNumber != null && <span className="text-indigo-500 font-black">#{p.jerseyNumber}</span>}
              <span className="truncate">{p.fullName}</span>
              {injuredIds.has(p.id) && <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              {positionAbbr(p.positionId, t)}
              {extra}
            </p>
          </div>
          <RatingChip rating={lp.rating} loadFailed={failedIds.has(lp.id)} />
        </button>
        {!isMobile && hoverId === lp.id && (
          <div className="absolute bottom-full mb-2 start-0 z-30 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 pointer-events-none">
            {renderPopoverBody(lp.id, false)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
      {/* Header: derived-shape chip + the "not a saved lineup" honesty caption + overlay toggle */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {formation && (
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                {t('teams.lineupShape', 'Shape: {{formation}}', { formation })}
              </span>
            )}
            {formation && (
              <span className="text-[11px] text-gray-400">{t('teams.lineupShapeImplied', 'implied by positions')}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {isLadder
              ? t('teams.lineupLadderCaption', 'Ranked by evidence rating — not an official ladder')
              : t('teams.lineupAutoArranged', 'Auto-arranged by rating — not a saved lineup')}
          </p>
        </div>
        {!isLadder && (
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
      </div>

      {overlay && !isLadder && (
        <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full ring-2 ring-red-500" /> {t('teams.lineupLegendInjured', 'Injured')}
          </span>
          <span className="flex items-center gap-1.5">
            <FlaskConical size={12} className="text-amber-500" /> {t('teams.lineupLegendThin', 'Needs testing (thin data)')}
          </span>
        </div>
      )}

      {failedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-700 dark:text-amber-400">
          <span>{t('teams.lineupLoadFailed', "Couldn't load ratings for {{count}} players.", { count: failedIds.size })}</span>
          <button
            type="button"
            onClick={() => queries.forEach(q => q.isError && q.refetch())}
            className="font-semibold underline cursor-pointer flex-shrink-0"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {/* The surface is a fixed spatial diagram — LTR by convention, like charts. */}
      {!isLadder && arrangement && (<>
      <div dir="ltr" className="relative mx-auto w-full max-w-md select-none" style={{ aspectRatio: layout.aspect }}>
        <SportSurface sportId={sportId} />
        {arrangement.placed.map(pp => {
          const p = playerById.get(pp.player.id);
          if (!p) return null;
          return (
            <div
              key={pp.player.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pp.x}%`, top: `${pp.y}%` }}
            >
              <LineupPlayerCard
                player={p}
                rating={pp.player.rating}
                loadFailed={failedIds.has(p.id)}
                injured={injuredIds.has(p.id)}
                overlay={overlay}
                accent={pp.accent}
                onActivate={() => activate(p.id)}
                onHoverChange={h => setHoverId(h ? p.id : null)}
              />
            </div>
          );
        })}
        {hoverAnchor && (
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="absolute z-30 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 pointer-events-none"
            style={{
              left: `${Math.min(72, Math.max(28, hoverAnchor.x))}%`,
              transform: 'translateX(-50%)',
              ...(hoverAnchor.y > 45
                ? { bottom: `${100 - hoverAnchor.y + 6}%` }
                : { top: `${hoverAnchor.y + 6}%` }),
            }}
          >
            {renderPopoverBody(hoverAnchor.player.id, false)}
          </div>
        )}
      </div>
      </>)}

      {/* Tennis: a ladder, not a court. The ≥3-metrics gate means an unproven
          player can never rank — they sit below the divider instead. */}
      {isLadder && ladder && (
        <div className="max-w-2xl">
          {ladder.ranked.length > 0 ? (
            <div className="space-y-2">
              {ladder.ranked.map((lp, i) => benchRow(lp, undefined, i + 1))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('teams.lineupLadderEmpty', 'No players have enough evidence to be ranked yet.')}
            </p>
          )}
          {ladder.unranked.length > 0 && (
            <div className="mt-5">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {t('teams.lineupLadderUnranked', 'Not enough data to rank')}
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                {t('teams.lineupLadderUnrankedDesc', 'A player needs at least {{count}} scored metrics to be ranked.', { count: MIN_METRICS_FOR_CONFIDENT_RATING })}
              </p>
              <div className="space-y-2">
                {ladder.unranked.map(lp => benchRow(lp))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-gray-400 mt-2">
        {isMobile
          ? t('teams.lineupHintMobile', 'Tap a player for their stat panel')
          : t('teams.lineupHintDesktop', 'Hover a player for stats · click to open their evidence profile')}
      </p>

      {arrangement && arrangement.bench.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
            {t('teams.lineupBench', 'Bench')} <span className="text-gray-400 font-medium">({arrangement.bench.length})</span>
          </h4>
          <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            {arrangement.bench.map(lp => benchRow(lp))}
          </div>
        </div>
      )}

      {arrangement && arrangement.unpositioned.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{t('teams.lineupUnpositioned', 'Unpositioned')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {arrangement.unpositioned.map(lp => benchRow(lp))}
          </div>
        </div>
      )}

      {(() => {
        const unavailable = (isLadder ? ladder?.excluded : arrangement?.excluded) ?? [];
        if (unavailable.length === 0) return null;
        return (
          <div className="mt-5">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{t('teams.lineupUnavailable', 'Unavailable')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unavailable.map(lp => {
                const p = playerById.get(lp.id);
                return benchRow(lp, p?.status ? <PlayerStatusBadge status={p.status} /> : undefined);
              })}
            </div>
          </div>
        );
      })()}

      {/* Mobile stat sheet (decision B: popover-first on mobile) */}
      {isMobile && sheetId != null && sheetPlayer && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSheetId(null)}>
          <div
            className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-white dark:bg-gray-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {renderPopoverBody(sheetId, true)}
          </div>
        </div>
      )}
    </div>
  );
}
