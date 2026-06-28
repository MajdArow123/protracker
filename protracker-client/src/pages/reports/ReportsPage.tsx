import { useNavigate } from 'react-router-dom';
import { BarChart2, Users, ArrowRight, GitCompare } from 'lucide-react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { useTeams } from '../../hooks/useTeams';
import { usePlayers } from '../../hooks/usePlayers';

export function ReportsPage() {
  const navigate = useNavigate();
  const { data: teams, isLoading: loadingTeams } = useTeams();
  const { data: players, isLoading: loadingPlayers } = usePlayers();

  if (loadingTeams || loadingPlayers) return <PageSpinner />;

  return (
    <PageWrapper
      title="Reports"
      actions={
        <Button variant="secondary" size="sm" onClick={() => navigate('/reports/compare')}>
          <GitCompare size={16} />
          Compare Players
        </Button>
      }
    >
      {/* Team Reports */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          <BarChart2 size={18} className="text-indigo-500" />
          Team Reports
        </h3>
        {!teams?.length ? (
          <EmptyState title="No teams yet" description="Create a team to generate team reports" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map(team => (
              <Card key={team.id} hover onClick={() => navigate(`/reports/team/${team.id}`)}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{team.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{team.sportName}</p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                      {team.playerCount ?? 0} players
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
                    View Report <ArrowRight size={14} />
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
          Player Reports
        </h3>
        {!players?.length ? (
          <EmptyState title="No players yet" description="Add players to generate individual reports" />
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
                  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-semibold text-sm">
                    {player.fullName.charAt(0)}
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={e => { e.stopPropagation(); navigate(`/reports/player/${player.id}`); }}
                  >
                    View Report <ArrowRight size={14} />
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
