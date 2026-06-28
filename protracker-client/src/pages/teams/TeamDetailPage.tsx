import { useParams, useNavigate } from 'react-router-dom';
import { useTeam } from '../../hooks/useTeams';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { ArrowLeft, Edit } from 'lucide-react';

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: team, isLoading } = useTeam(Number(id));

  if (isLoading) return <PageSpinner />;
  if (!team)
    return (
      <PageWrapper>
        <p className="text-red-500">Team not found.</p>
      </PageWrapper>
    );

  return (
    <PageWrapper
      title={team.name}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/teams')}>
            <ArrowLeft size={16} /> Back
          </Button>
          <Button size="sm" onClick={() => navigate(`/teams/${id}/edit`)}>
            <Edit size={16} /> Edit
          </Button>
        </div>
      }
    >
      <Card>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Sport</dt>
            <dd className="font-medium text-gray-800 dark:text-gray-200 mt-1">
              {team.sportName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Players</dt>
            <dd className="mt-1">
              <Badge variant="info">{team.playerCount ?? 0}</Badge>
            </dd>
          </div>
        </dl>
      </Card>
    </PageWrapper>
  );
}
