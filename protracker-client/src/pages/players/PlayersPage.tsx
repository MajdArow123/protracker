import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Search, AlertTriangle } from 'lucide-react';
import { usePlayers } from '../../hooks/usePlayers';
import { useTeams } from '../../hooks/useTeams';
import { useActiveInjuries } from '../../hooks/useInjuries';
import { motion } from 'framer-motion';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { staggerContainer, staggerItem } from '../../utils/animations';
import { Button } from '../../components/ui/Button';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { PlayerStatusBadge } from '../../components/players/PlayerStatusBadge';
import { clsx } from 'clsx';

const SPORT_EMOJIS: Record<number, string> = {
  1: '⚽',
  2: '🏀',
  3: '🏐',
  4: '🏖️',
  5: '🎾',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function scoreColor(score: number) {
  if (score > 7) return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (score >= 5) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border border-red-500/30';
}

export function PlayersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: players, isLoading, isError, refetch } = usePlayers();
  const { data: teams = [] } = useTeams();
  const { data: activeInjuries = [] } = useActiveInjuries();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  const injuredIds = new Set(activeInjuries.map(i => i.playerId));

  if (isLoading) return <PageWrapper title={t('players.title', 'Players')}><CardListSkeleton count={6} /></PageWrapper>;
  if (isError) return <PageWrapper title={t('players.title', 'Players')}><ErrorState thing="players" onRetry={() => refetch()} /></PageWrapper>;

  const filtered = (players ?? []).filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = !teamFilter || String(p.teamId) === teamFilter;
    return matchesSearch && matchesTeam;
  });

  return (
    <PageWrapper
      title={t('players.title', 'Players')}
      actions={
        <Button onClick={() => navigate('/players/new')}>
          <Plus size={16} /> {t('players.addPlayer', 'Add Player')}
        </Button>
      }
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('players.searchPlayers', 'Search players...')}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
        </div>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
        >
          <option value="">{t('players.allTeams', 'All teams')}</option>
          {teams.map(t => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>
      </div>

      {!filtered.length ? (
        search || teamFilter ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('players.noMatchFilters', 'No players match your filters.')}</p>
        ) : (
          <EmptyState
            icon={<Users size={48} />}
            title={t('players.noPlayers', 'No players yet')}
            description={t('players.noPlayersDesc', 'Add your first player to get started')}
            action={{ label: t('players.addPlayer', 'Add Player'), onClick: () => navigate('/players/new') }}
          />
        )
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {filtered.map(player => {
            const emoji = SPORT_EMOJIS[player.sportId] ?? '🏅';
            return (
              <motion.button
                key={player.id}
                variants={staggerItem}
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.15 }}
                onClick={() => navigate(`/players/${player.id}`)}
                className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/5 transition-colors cursor-pointer text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-black flex-shrink-0 group-hover:bg-indigo-600/25 transition-colors">
                  {getInitials(player.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {player.jerseyNumber != null && <span className="text-indigo-500 font-black mr-1">#{player.jerseyNumber}</span>}
                      {player.fullName}
                    </p>
                    <span className="text-base flex-shrink-0">{emoji}</span>
                    {injuredIds.has(player.id) && (
                      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" aria-label={t('players.activeInjury', 'Active injury')} />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{player.positionName ?? t('players.player', 'Player')} · {player.teamName ?? '—'}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {player.fitnessLevel != null && (
                    <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', scoreColor(player.fitnessLevel))}>
                      {t('players.fitShort', 'Fit')} {player.fitnessLevel}/10
                    </span>
                  )}
                  <PlayerStatusBadge status={player.status} hideActive />
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </PageWrapper>
  );
}
