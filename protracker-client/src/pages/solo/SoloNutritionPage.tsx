import { useMyPlayerId } from '../../hooks/useDashboard';
import { NutritionManager } from '../nutrition/NutritionPage';
import { StatGridSkeleton } from '../../components/ui/Skeleton';

// Solo athlete's self-managed nutrition: same three tabs as the coach view
// (Dietary Profile / Nutrition Guidance / Weekly Plan), scoped to themselves,
// with food swapping enabled and first-person wording.
export function SoloNutritionPage() {
  const { data: playerId, isLoading } = useMyPlayerId();

  if (isLoading || !playerId) {
    return <div className="flex-1 p-4 lg:p-6"><StatGridSkeleton count={2} /></div>;
  }

  return <NutritionManager playerId={playerId} self title="My Nutrition" />;
}
