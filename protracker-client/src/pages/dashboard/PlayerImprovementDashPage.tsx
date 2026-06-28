import { useMyPlayerId } from '../../hooks/useDashboard';
import { usePlayerImprovementPlans } from '../../hooks/useImprovement';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

function Section({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{value}</p>
    </div>
  );
}

export function PlayerImprovementDashPage() {
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: plans, isLoading } = usePlayerImprovementPlans(playerId);

  if (loadingId || isLoading) return <PageSpinner />;

  const latestPlan = plans?.[0];

  return (
    <PageWrapper title="My Improvement Plan">
      {!latestPlan ? (
        <EmptyState
          title="No improvement plan yet"
          description="Your coach hasn't created a plan for you yet"
        />
      ) : (
        <Card
          header={
            <div className="flex items-center justify-between">
              <span>Improvement Plan</span>
              <div className="flex items-center gap-2">
                {latestPlan.isAIGenerated && (
                  <Badge variant="info">AI Generated</Badge>
                )}
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  {new Date(latestPlan.createdDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          }
        >
          <Section label="Weekly Goals" value={latestPlan.weeklyGoals} />
          <Section label="Training Recommendations" value={latestPlan.trainingRecommendations} />
          <Section label="Skill Targets" value={latestPlan.skillTargets} />
          <Section label="Sport-Specific Drills" value={latestPlan.sportSpecificDrills} />
          <Section label="Position Focus" value={latestPlan.positionFocus} />
          <Section label="Coach Notes" value={latestPlan.coachNotes} />

          {plans.length > 1 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              {plans.length - 1} previous plan{plans.length > 2 ? 's' : ''} not shown
            </p>
          )}
        </Card>
      )}
    </PageWrapper>
  );
}
