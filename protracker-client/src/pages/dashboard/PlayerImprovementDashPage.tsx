import { useMyPlayerId } from '../../hooks/useDashboard';
import { usePlayerImprovementPlans } from '../../hooks/useImprovement';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import {
  Target, Dumbbell, Star, Zap, MapPin, MessageSquare, ClipboardList,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SectionConfig {
  label: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  value: string | null | undefined;
}

function PlanSection({ label, icon: Icon, iconBg, iconColor, borderColor, value }: SectionConfig) {
  if (!value) return null;
  return (
    <div className={clsx(
      'rounded-2xl border-l-4 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex gap-4',
      borderColor
    )}>
      <div className={clsx('p-2.5 rounded-xl h-fit flex-shrink-0', iconBg)}>
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
          {label}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">
          {value}
        </p>
      </div>
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
          icon={<ClipboardList size={32} />}
          title="No improvement plan yet"
          description="Your coach hasn't created a plan for you yet"
        />
      ) : (
        <div className="space-y-4">
          {/* Header card */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white text-base">Current Training Plan</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Created {new Date(latestPlan.createdDate).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {latestPlan.isAIGenerated && <Badge variant="info">AI Generated</Badge>}
              </div>
            </div>
          </div>

          {/* Section cards */}
          <PlanSection
            label="Weekly Goals"
            icon={Target}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-500"
            borderColor="border-l-amber-500 dark:border-l-amber-500"
            value={latestPlan.weeklyGoals}
          />
          <PlanSection
            label="Training Recommendations"
            icon={Dumbbell}
            iconBg="bg-indigo-500/10"
            iconColor="text-indigo-500"
            borderColor="border-l-indigo-500 dark:border-l-indigo-500"
            value={latestPlan.trainingRecommendations}
          />
          <PlanSection
            label="Skill Targets"
            icon={Star}
            iconBg="bg-purple-500/10"
            iconColor="text-purple-500"
            borderColor="border-l-purple-500 dark:border-l-purple-500"
            value={latestPlan.skillTargets}
          />
          <PlanSection
            label="Sport-Specific Drills"
            icon={Zap}
            iconBg="bg-cyan-500/10"
            iconColor="text-cyan-500"
            borderColor="border-l-cyan-500 dark:border-l-cyan-500"
            value={latestPlan.sportSpecificDrills}
          />
          <PlanSection
            label="Position Focus"
            icon={MapPin}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            borderColor="border-l-blue-500 dark:border-l-blue-500"
            value={latestPlan.positionFocus}
          />
          <PlanSection
            label="Coach Notes"
            icon={MessageSquare}
            iconBg="bg-green-500/10"
            iconColor="text-green-500"
            borderColor="border-l-green-500 dark:border-l-green-500"
            value={latestPlan.coachNotes}
          />

          {plans && plans.length > 1 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-2">
              {plans.length - 1} previous plan{plans.length > 2 ? 's' : ''} not shown
            </p>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
