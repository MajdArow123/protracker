import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { AlertTriangle, LayoutGrid, Users } from 'lucide-react';
import { useTeamEvidenceScores } from '../../../hooks/useEvidence';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useDynamicLabels } from '../../../i18n/dynamicLabels';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { PlayerAvatar } from '../../players/PlayerAvatar';
import { PlayerStatusBadge } from '../../players/PlayerStatusBadge';
import { RatingChip } from './LineupPlayerCard';
import { StatPopover } from './StatPopover';
import { LineupBoard } from './LineupBoard';
import { layoutForSport, positionAbbr } from './lineupLayouts';
import {
  buildLadder, categoryBreakdown, computeOverallRating,
  MIN_METRICS_FOR_CONFIDENT_RATING, type LineupPlayer,
} from './lineupLogic';
import type { EvidenceBasedScore, Player } from '../../../types';

interface Props {
  teamId: number;
  sportId: number;
  sportName: string;
  players: Player[];
  injuredIds: Set<number>;
  canManage: boolean;
  /** Mirror of canPublishLineup — the server stays the real gate. */
  canPublish: boolean;
  /** Open the board already keyed to this match (deep link / build-from-match). */
  initialMatchId?: number | null;
}

// Lineup tab shell: loads the roster's evidence scores in ONE batch request
// (priming the per-player caches the rest of the app shares), then renders the
// editable board (Phase 2) or the read-only tennis ladder.
export function TeamLineupSection({ teamId, sportId, sportName, players, injuredIds, canManage, canPublish, initialMatchId }: Props) {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [sheetId, setSheetId] = useState<number | null>(null);

  const layout = layoutForSport(sportId);
  const batch = useTeamEvidenceScores(teamId, layout != null);

  // Prime the per-player caches (['evidence','scores',id]) so popovers, player
  // pages and mutations keep working off the exact same data.
  useEffect(() => {
    if (!batch.data) return;
    for (const entry of batch.data) {
      qc.setQueryData(['evidence', 'scores', entry.playerId], entry.scores);
    }
  }, [batch.data, qc]);

  const { lineupPlayers, scoresById } = useMemo(() => {
    const byId = new Map<number, EvidenceBasedScore[]>(
      (batch.data ?? []).map(e => [e.playerId, e.scores]),
    );
    const lineupPlayers: LineupPlayer[] = players.map(p => ({
      id: p.id,
      name: p.fullName,
      positionId: p.positionId ?? null,
      status: p.status ?? 'Active',
      rating: computeOverallRating(byId.get(p.id) ?? []),
    }));
    return { lineupPlayers, scoresById: byId };
  }, [players, batch.data]);

  const ladder = useMemo(
    () => (layout?.kind === 'ladder' ? buildLadder(lineupPlayers) : null),
    [lineupPlayers, layout?.kind],
  );

  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

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

  if (batch.isLoading) {
    return (
      <div className="mx-auto w-full max-w-md">
        <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: layout.kind === 'ladder' ? '3 / 4' : layout.aspect }} />
      </div>
    );
  }

  const renderPopoverBody = (id: number, showProfileButton: boolean) => {
    const p = playerById.get(id);
    if (!p) return null;
    const lp = lineupPlayers.find(x => x.id === id);
    return (
      <StatPopover
        player={p}
        rating={lp?.rating ?? { kind: 'none' }}
        breakdown={categoryBreakdown(scoresById.get(id) ?? [])}
        injured={injuredIds.has(id)}
        onViewProfile={() => navigate(`/players/${id}?tab=evidence`)}
        showProfileButton={showProfileButton}
      />
    );
  };

  const ladderRow = (lp: LineupPlayer, extra?: ReactNode, rank?: number) => {
    const p = playerById.get(lp.id);
    if (!p) return null;
    const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-gray-400';
    return (
      <div key={lp.id} className="relative">
        <button
          type="button"
          onClick={() => (isMobile ? setSheetId(lp.id) : navigate(`/players/${lp.id}?tab=evidence`))}
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
          <RatingChip rating={lp.rating} loadFailed={batch.isError} />
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
      {batch.isError && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-700 dark:text-amber-400">
          <span>{t('teams.lineupBatchFailed', "Couldn't load the roster's evidence ratings.")}</span>
          <button type="button" onClick={() => batch.refetch()} className="font-semibold underline cursor-pointer flex-shrink-0">
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {layout.kind !== 'ladder' ? (
        <LineupBoard
          teamId={teamId}
          sportId={sportId}
          players={players}
          lineupPlayers={lineupPlayers}
          scoresById={scoresById}
          failedIds={batch.isError ? new Set(players.map(p => p.id)) : new Set()}
          injuredIds={injuredIds}
          canManage={canManage}
          canPublish={canPublish}
          initialMatchId={initialMatchId}
        />
      ) : (
        <div className="max-w-2xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t('teams.lineupLadderCaption', 'Ranked by evidence rating — not an official ladder')}
          </p>
          {ladder && ladder.ranked.length > 0 ? (
            <div className="space-y-2">
              {ladder.ranked.map((lp, i) => ladderRow(lp, undefined, i + 1))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('teams.lineupLadderEmpty', 'No players have enough evidence to be ranked yet.')}
            </p>
          )}
          {ladder && ladder.unranked.length > 0 && (
            <div className="mt-5">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {t('teams.lineupLadderUnranked', 'Not enough data to rank')}
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                {t('teams.lineupLadderUnrankedDesc', 'A player needs at least {{count}} scored metrics to be ranked.', { count: MIN_METRICS_FOR_CONFIDENT_RATING })}
              </p>
              <div className="space-y-2">
                {ladder.unranked.map(lp => ladderRow(lp))}
              </div>
            </div>
          )}
          {ladder && ladder.excluded.length > 0 && (
            <div className="mt-5">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">{t('teams.lineupUnavailable', 'Unavailable')}</h4>
              <div className="space-y-2">
                {ladder.excluded.map(lp => {
                  const p = playerById.get(lp.id);
                  return ladderRow(lp, p?.status ? <PlayerStatusBadge status={p.status} /> : undefined);
                })}
              </div>
            </div>
          )}
          <p className="text-center text-[11px] text-gray-400 mt-3">
            {isMobile
              ? t('teams.lineupHintMobile', 'Tap a player for their stat panel')
              : t('teams.lineupHintDesktop', 'Hover a player for stats · click to open their evidence profile')}
          </p>
        </div>
      )}

      {isMobile && sheetId != null && playerById.has(sheetId) && layout.kind === 'ladder' && (
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
