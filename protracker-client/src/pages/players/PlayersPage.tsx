import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { usePlayers } from '../../hooks/usePlayers';
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

  if (isLoading) return <PageSpinner />;

  return (
    <PageWrapper
      title="Players"
      actions={
        <Button onClick={() => navigate('/players/new')}>
          <Plus size={16} /> Add Player
        </Button>
      }
    >
      {!players?.length ? (
        <EmptyState
          icon={<Users size={48} />}
          title="No players yet"
          description="Add your first player to get started"
          action={{
            label: 'Add Player',
            onClick: () => navigate('/players/new'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((player) => (
            <Card
              key={player.id}
              hover
              onClick={() => navigate(`/players/${player.id}`)}
            >
              <div className="flex items-center gap-3">
                <Avatar name={player.fullName} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {player.fullName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {player.positionName ?? 'Player'}
                  </p>
                </div>
              </div>
              {player.teamName && (
                <Badge variant="info" className="mt-3">
                  {player.teamName}
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
