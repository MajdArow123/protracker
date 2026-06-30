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
import { Trophy, UtensilsCrossed, Droplets, CheckCircle2, XCircle, Salad } from 'lucide-react';

function GuidanceRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  rowBg,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  rowBg?: string;
}) {
  return (
    <div className={`flex gap-3 rounded-xl p-3 ${rowBg ?? ''}`}>
      <div className={`p-2 rounded-lg h-fit flex-shrink-0 ${iconBg}`}>
        <Icon size={15} className={iconColor} />
      </div>
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${iconColor}`}>{label}</p>
        <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

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
        {/* Dietary profile */}
        <Card header="Dietary Preferences & Restrictions">
          {!profile?.length ? (
            <EmptyState
              icon={<Salad size={32} />}
              title="No dietary profile"
              description="Your coach will set up your dietary profile"
            />
          ) : (
            <div className="space-y-3">
              {profile.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between py-3 px-1 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div>
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                      {item.category}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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

        {/* Nutrition guidance */}
        <Card header="Nutrition Guidance">
          {!guidance?.length ? (
            <EmptyState
              icon={<Trophy size={32} />}
              title="No guidance yet"
              description="Your coach will add nutrition guidance here"
            />
          ) : (
            <div className="space-y-6">
              {guidance.map((g) => (
                <div
                  key={g.id}
                  className="border-b border-gray-100 dark:border-gray-800 pb-6 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(g.createdDate).toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                    {g.isAIGenerated && <Badge variant="info">AI Generated</Badge>}
                  </div>

                  <div className="space-y-2">
                    {g.goal && (
                      <GuidanceRow
                        icon={Trophy}
                        iconBg="bg-amber-500/10"
                        iconColor="text-amber-500"
                        label="Goal"
                        value={g.goal}
                      />
                    )}
                    {g.mealSuggestions && (
                      <GuidanceRow
                        icon={UtensilsCrossed}
                        iconBg="bg-orange-500/10"
                        iconColor="text-orange-500"
                        label="Meals"
                        value={g.mealSuggestions}
                      />
                    )}
                    {g.hydrationTips && (
                      <GuidanceRow
                        icon={Droplets}
                        iconBg="bg-cyan-500/10"
                        iconColor="text-cyan-500"
                        label="Hydration"
                        value={g.hydrationTips}
                      />
                    )}
                    {g.foodsToPrioritize && (
                      <GuidanceRow
                        icon={CheckCircle2}
                        iconBg="bg-green-500/10"
                        iconColor="text-green-500"
                        label="Prioritize"
                        value={g.foodsToPrioritize}
                        rowBg="bg-green-500/5 rounded-xl"
                      />
                    )}
                    {g.foodsToLimit && (
                      <GuidanceRow
                        icon={XCircle}
                        iconBg="bg-red-500/10"
                        iconColor="text-red-500"
                        label="Limit"
                        value={g.foodsToLimit}
                        rowBg="bg-red-500/5 rounded-xl"
                      />
                    )}
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
