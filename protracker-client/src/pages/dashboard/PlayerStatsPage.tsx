import { useMyPlayerId } from '../../hooks/useDashboard';
import { usePlayerAssessments } from '../../hooks/useAssessments';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChartWrapper } from '../../components/charts/LineChartWrapper';

const CHART_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
];

export function PlayerStatsPage() {
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: assessments, isLoading } = usePlayerAssessments(playerId);

  if (loadingId || isLoading) return <PageSpinner />;

  const chartData: Array<{ name: string; [key: string]: string | number }> =
    assessments?.map((a) => {
      const point: { name: string; [key: string]: string | number } = {
        name: a.assessmentPeriodName || new Date(a.dateRecorded).toLocaleDateString(),
      };
      a.statScores?.forEach((s) => {
        point[s.statCategoryName] = s.score;
      });
      return point;
    }) ?? [];

  const allCategories = [
    ...new Set(
      assessments?.flatMap(
        (a) => a.statScores?.map((s) => s.statCategoryName) ?? []
      ) ?? []
    ),
  ];

  return (
    <PageWrapper title="My Stats">
      {!assessments?.length ? (
        <EmptyState
          title="No stats yet"
          description="Your coach will add assessments here"
        />
      ) : (
        <Card header="Progress Over Time">
          <LineChartWrapper
            data={chartData}
            series={allCategories.map((cat, i) => ({
              key: cat,
              name: cat,
              color: CHART_COLORS[i % CHART_COLORS.length],
            }))}
          />
        </Card>
      )}
    </PageWrapper>
  );
}
