import { useNavigate } from 'react-router-dom';
import { Shield, Plus } from 'lucide-react';
import { useTeams } from '../../hooks/useTeams';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';

export function TeamsPage() {
  const navigate = useNavigate();
  const { data: teams, isLoading } = useTeams();

  if (isLoading) return <PageSpinner />;

  return (
    <PageWrapper
      title="Teams"
      actions={
        <Button onClick={() => navigate('/teams/new')}>
          <Plus size={16} /> New Team
        </Button>
      }
    >
      {!teams?.length ? (
        <EmptyState
          icon={<Shield size={48} />}
          title="No teams yet"
          description="Create your first team to get started"
          action={{ label: 'Create Team', onClick: () => navigate('/teams/new') }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card
              key={team.id}
              hover
              onClick={() => navigate(`/teams/${team.id}`)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                    {team.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {team.sportName}
                  </p>
                </div>
                <Badge variant="info">{team.playerCount ?? 0} players</Badge>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                {team.sportName}
              </p>
            </Card>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
