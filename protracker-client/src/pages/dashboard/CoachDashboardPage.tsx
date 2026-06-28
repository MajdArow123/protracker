import { Users, Shield, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCoachDashboard } from '../../hooks/useDashboard';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';

export function CoachDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCoachDashboard();

  if (isLoading) return <PageSpinner />;
  if (isError)
    return (
      <PageWrapper>
        <p className="text-red-600 dark:text-red-400">
          Failed to load dashboard data.
        </p>
      </PageWrapper>
    );

  const firstName = user?.fullName?.split(' ')[0] ?? 'Coach';

  return (
    <PageWrapper title={`Welcome back, ${firstName}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Players"
          value={data?.totalPlayers ?? 0}
          icon={<Users size={20} />}
        />
        <StatCard
          title="Total Teams"
          value={data?.totalTeams ?? 0}
          icon={<Shield size={20} />}
        />
        <StatCard
          title="Assessments"
          value="—"
          icon={<ClipboardList size={20} />}
        />
      </div>

      <Card header="My Teams">
        {!data?.teams?.length ? (
          <EmptyState
            title="No teams yet"
            description="Create your first team to get started"
            action={{ label: 'Create Team', onClick: () => navigate('/teams/new') }}
          />
        ) : (
          <div className="space-y-3">
            {data.teams.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/teams/${t.id}`)}
                className="flex items-center justify-between py-3 px-1 border-b border-gray-100 dark:border-gray-700 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t.sportName}
                  </p>
                </div>
                <Badge variant="info">{t.playerCount ?? 0} players</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageWrapper>
  );
}
