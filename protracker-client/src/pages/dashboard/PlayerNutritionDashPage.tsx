import { useMyPlayerId } from '../../hooks/useDashboard';
import {
  usePlayerNutritionProfile,
  usePlayerNutritionGuidance,
} from '../../hooks/useNutrition';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';

export function PlayerNutritionDashPage() {
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: profile, isLoading: loadingProfile } =
    usePlayerNutritionProfile(playerId);
  const { data: guidance, isLoading: loadingGuidance } =
    usePlayerNutritionGuidance(playerId);

  if (loadingId || loadingProfile || loadingGuidance) return <PageSpinner />;

  return (
    <PageWrapper title="My Nutrition">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card header="Dietary Preferences & Restrictions">
          {!profile?.length ? (
            <EmptyState
              title="No dietary profile"
              description="Your coach will set up your dietary profile"
            />
          ) : (
            <div className="space-y-3">
              {profile.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">
                      {item.category}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.preferenceType}
                      {item.specificItem ? ` · ${item.specificItem}` : ''}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      item.severity === 'Allergy'
                        ? 'danger'
                        : item.severity === 'Intolerance'
                        ? 'warning'
                        : 'neutral'
                    }
                    className="ml-3 flex-shrink-0"
                  >
                    {item.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card header="Nutrition Guidance">
          {!guidance?.length ? (
            <EmptyState
              title="No guidance yet"
              description="Your coach will add nutrition guidance here"
            />
          ) : (
            <div className="space-y-6">
              {guidance.map((g) => (
                <div
                  key={g.id}
                  className="border-b border-gray-100 dark:border-gray-700 pb-6 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(g.createdDate).toLocaleDateString()}
                    </p>
                    {g.isAIGenerated && (
                      <Badge variant="info">AI Generated</Badge>
                    )}
                  </div>
                  {g.goal && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Goal</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{g.goal}</p>
                    </div>
                  )}
                  {g.mealSuggestions && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Meals</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{g.mealSuggestions}</p>
                    </div>
                  )}
                  {g.hydrationTips && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hydration</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{g.hydrationTips}</p>
                    </div>
                  )}
                  {g.foodsToPrioritize && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Prioritize</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{g.foodsToPrioritize}</p>
                    </div>
                  )}
                  {g.foodsToLimit && (
                    <div>
                      <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">Limit</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{g.foodsToLimit}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
