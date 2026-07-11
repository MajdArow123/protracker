import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart2, Users, ArrowRight, GitCompare } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { useTeams } from '../../hooks/useTeams';
import { usePlayers } from '../../hooks/usePlayers';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { sportBadge, sportDot } from '../../utils/sportColors';
import { clsx } from 'clsx';

export function ReportsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: teams, isLoading: loadingTeams } = useTeams();
  const { data: players, isLoading: loadingPlayers } = usePlayers();

  if (loadingTeams || loadingPlayers) return <PageWrapper title={t('reports.title', 'Reports')}><CardListSkeleton count={6} /></PageWrapper>;

  return (
    <PageWrapper
      title={t('reports.title', 'Reports')}
      actions={
        <Button variant="secondary" size="sm" onClick={() => navigate('/reports/compare')}>
          <GitCompare size={16} />
          {t('reports.comparePlayers', 'Compare Players')}
        </Button>
      }
    >
      {/* Team Reports */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          <BarChart2 size={18} className="text-indigo-500" />
          {t('reports.teamReports', 'Team Reports')}
        </h3>
        {!teams?.length ? (
          <EmptyState title={t('reports.noTeams', 'No teams yet')} description={t('reports.noTeamsDesc', 'Create a team to generate team reports')} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map(team => (
              <Card key={team.id} hover onClick={() => navigate(`/reports/team/${team.id}`)}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', sportDot(team.sportName))} />
                      {team.name}
                    </p>
                    <span className={clsx('inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1.5', sportBadge(team.sportName))}>
                      {team.sportName}
                    </span>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1.5">
                      {t('reports.playersCount', '{{count}} players', { count: team.playerCount ?? 0 })}
                    </p>
                  </div>
                  <div className="text-indigo-500">
                    <BarChart2 size={20} />
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={e => { e.stopPropagation(); navigate(`/reports/team/${team.id}`); }}
                  >
                    {t('reports.viewReport', 'View Report')} <ArrowRight size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Player Reports */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          <Users size={18} className="text-indigo-500" />
          {t('reports.playerReports', 'Player Reports')}
        </h3>
        {!players?.length ? (
          <EmptyState title={t('reports.noPlayers', 'No players yet')} description={t('reports.noPlayersDesc', 'Add players to generate individual reports')} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map(player => (
              <Card key={player.id} hover onClick={() => navigate(`/reports/player/${player.id}`)}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{player.fullName}</p>
                    {player.positionName && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{player.positionName}</p>
                    )}
                    {player.teamName && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{player.teamName}</p>
                    )}
                  </div>
                  <PlayerAvatar name={player.fullName} imageUrl={player.profileImageUrl} sportId={player.sportId} size={38} />
                </div>
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={e => { e.stopPropagation(); navigate(`/reports/player/${player.id}`); }}
                  >
                    {t('reports.viewReport', 'View Report')} <ArrowRight size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageWrapper>
  );
}
