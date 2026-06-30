import { useSearchParams } from 'react-router-dom';
import { useMyPlayerId } from '../../hooks/useDashboard';
import {
  usePlayerNutritionProfile,
  usePlayerNutritionGuidance,
  useWeeklyNutritionPlan,
} from '../../hooks/useNutrition';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { WeeklyNutritionPlanView } from '../../components/nutrition/WeeklyNutritionPlanView';
import { Trophy, UtensilsCrossed, Droplets, CheckCircle2, XCircle, Salad, CalendarDays } from 'lucide-react';
import { clsx } from 'clsx';

type Tab = 'guidance' | 'weekly' | 'profile';

function GuidanceRow({
  icon: Icon, iconBg, iconColor, label, value, rowBg,
}: {
  icon: React.ElementType; iconBg: string; iconColor: string;
  label: string; value: string; rowBg?: string;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab | null) ?? 'weekly';
  const setActiveTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true });
  const { data: playerId, isLoading: loadingId } = useMyPlayerId();
  const { data: profile, isLoading: loadingProfile } = usePlayerNutritionProfile(playerId);
  const { data: guidance, isLoading: loadingGuidance } = usePlayerNutritionGuidance(playerId);
  const { data: weeklyPlan, isLoading: loadingWeekly } = useWeeklyNutritionPlan(playerId);

  if (loadingId) return <PageSpinner />;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'weekly', label: 'Weekly Plan' },
    { id: 'guidance', label: 'Guidance' },
    { id: 'profile', label: 'Dietary Profile' },
  ];

  return (
    <PageWrapper title="My Nutrition">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/60 mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Weekly Plan tab */}
      {activeTab === 'weekly' && (
        loadingWeekly ? <PageSpinner /> :
        !weeklyPlan ? (
          <EmptyState
            icon={<CalendarDays size={32} />}
            title="No weekly plan yet"
            description="Your coach will generate a personalized 7-day nutrition plan for you"
          />
        ) : (
          <WeeklyNutritionPlanView
            plan={weeklyPlan}
            canSwap={true}
            isCoach={false}
            playerId={playerId!}
          />
        )
      )}

      {/* Guidance tab */}
      {activeTab === 'guidance' && (
        loadingGuidance ? <PageSpinner /> :
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
                <div key={g.id} className="border-b border-gray-100 dark:border-gray-800 pb-6 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(g.createdDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    {g.isAIGenerated && <Badge variant="info">AI Generated</Badge>}
                  </div>
                  <div className="space-y-2">
                    {g.goal && <GuidanceRow icon={Trophy} iconBg="bg-amber-500/10" iconColor="text-amber-500" label="Goal" value={g.goal} />}
                    {g.mealSuggestions && <GuidanceRow icon={UtensilsCrossed} iconBg="bg-orange-500/10" iconColor="text-orange-500" label="Meals" value={g.mealSuggestions} />}
                    {g.hydrationTips && <GuidanceRow icon={Droplets} iconBg="bg-cyan-500/10" iconColor="text-cyan-500" label="Hydration" value={g.hydrationTips} />}
                    {g.foodsToPrioritize && <GuidanceRow icon={CheckCircle2} iconBg="bg-green-500/10" iconColor="text-green-500" label="Prioritize" value={g.foodsToPrioritize} rowBg="bg-green-500/5" />}
                    {g.foodsToLimit && <GuidanceRow icon={XCircle} iconBg="bg-red-500/10" iconColor="text-red-500" label="Limit" value={g.foodsToLimit} rowBg="bg-red-500/5" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Dietary Profile tab */}
      {activeTab === 'profile' && (
        loadingProfile ? <PageSpinner /> :
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
                <div key={item.id} className="flex items-start justify-between py-3 px-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div>
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">{item.category}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.preferenceType}{item.specificItem ? ` · ${item.specificItem}` : ''}
                    </p>
                    {item.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{item.notes}</p>}
                  </div>
                  <Badge
                    variant={item.severity === 'Allergy' ? 'danger' : item.severity === 'Intolerance' ? 'warning' : 'neutral'}
                    className="ml-3 flex-shrink-0"
                  >
                    {item.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </PageWrapper>
  );
}
