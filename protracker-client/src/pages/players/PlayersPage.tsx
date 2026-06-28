import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search } from 'lucide-react';
import { usePlayers } from '../../hooks/usePlayers';
import { useTeams } from '../../hooks/useTeams';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';

export function PlayersPage() {
  const navigate = useNavigate();
  const { data: players, isLoading } = usePlayers();
  const { data: teams = [] } = useTeams();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  if (isLoading) return <PageSpinner />;

  const filtered = (players ?? []).filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesTeam = !teamFilter || String(p.teamId) === teamFilter;
    return matchesSearch && matchesTeam;
  });

  return (
    <PageWrapper
      title="Players"
      actions={
        <Button onClick={() => navigate('/players/new')}>
          <Plus size={16} /> Add Player
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
            placeholder="Search players…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All teams</option>
          {teams.map(t => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>
      </div>

      {!filtered.length ? (
        search || teamFilter ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No players match your filters.</p>
        ) : (
          <EmptyState
            icon={<Users size={48} />}
            title="No players yet"
            description="Add your first player to get started"
            action={{ label: 'Add Player', onClick: () => navigate('/players/new') }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(player => (
            <Card key={player.id} hover onClick={() => navigate(`/players/${player.id}`)}>
              <div className="flex items-center gap-3">
                <Avatar name={player.fullName} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{player.fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{player.positionName ?? 'Player'}</p>
                </div>
              </div>
              {player.teamName && (
                <Badge variant="info" className="mt-3">{player.teamName}</Badge>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
