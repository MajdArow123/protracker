import { useMyPlayerId, usePlayerDashboard } from '../../hooks/useDashboard';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatCard } from '../../components/ui/StatCard';
import { RadarChartWrapper } from '../../components/charts/RadarChartWrapper';
import { useAuth } from '../../context/AuthContext';
import { Activity, ClipboardList } from 'lucide-react';

export function PlayerDashboardPage() {
  const { user } = useAuth();
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data, isLoading, isError } = usePlayerDashboard(playerId);

  if (loadingId || isLoading) return <PageSpinner />;
  if (isError)
    return (
      <PageWrapper>
        <p className="text-red-600 dark:text-red-400">
          Failed to load dashboard data.
        </p>
      </PageWrapper>
    );

  const firstName = user?.fullName?.split(' ')[0] ?? 'Athlete';

  const latestAssessment = data?.recentAssessments?.[0];
  const radarData =
    latestAssessment?.statScores?.map((s) => ({
      subject: s.statCategoryName,
      value: s.score,
    })) ?? [];

  return (
    <PageWrapper title={`Hi, ${firstName}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Total Assessments"
          value={data?.totalAssessments ?? 0}
          icon={<ClipboardList size={20} />}
        />
        <StatCard
          title="Latest Avg Score"
          value={
            data?.latestAverageScore != null
              ? data.latestAverageScore.toFixed(1)
              : '—'
          }
          icon={<Activity size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card header="Latest Assessment">
          {!latestAssessment ? (
            <EmptyState
              title="No assessments yet"
              description="Your coach hasn't assessed you yet"
            />
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {latestAssessment.assessmentPeriodName}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                {new Date(latestAssessment.dateRecorded).toLocaleDateString()}
              </p>
              {radarData.length > 0 && (
                <RadarChartWrapper data={radarData} />
              )}
            </>
          )}
        </Card>

        <Card header="Recent Assessments">
          {!data?.recentAssessments?.length ? (
            <EmptyState
              title="No assessments yet"
              description="Your coach will add assessments here"
            />
          ) : (
            <div className="space-y-3">
              {data.recentAssessments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                      {a.assessmentPeriodName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(a.dateRecorded).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      {a.statScores?.length ?? 0} stats
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
