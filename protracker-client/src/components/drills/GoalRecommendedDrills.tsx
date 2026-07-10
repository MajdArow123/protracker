import { useState } from 'react';
import { Dumbbell, ChevronDown, ChevronUp, Plus, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { AssignDrillModal } from './AssignDrillModal';
import { DIFFICULTY_BADGE } from './drillUtils';
import { useDrills } from '../../hooks/useDrills';
import type { Drill, PersonalGoal } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

interface Props {
  goal: PersonalGoal;
  sportId?: number;
  canAssign: boolean;
}

// Drills relevant to a goal — filtered by the goal's linked assessment category. Connects the
// goals → drills → tasks flow. Only shown for goals linked to a stat category.
export function GoalRecommendedDrills({ goal, sportId, canAssign }: Props) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState<Drill | null>(null);
  const category = goal.linkedStatCategoryName;

  const { data } = useDrills({ sport: sportId, pageSize: 100 }, open && !!sportId);
  if (!category || !sportId) return null;

  const matches = (data?.items ?? [])
    .filter(d => d.targetStatCategories.some(t => t.toLowerCase() === category.toLowerCase()))
    .slice(0, 4);

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:underline cursor-pointer">
        <Dumbbell size={13} /> {tr('drills.recommendedDrills', 'Recommended drills')} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {matches.length === 0 ? (
            <p className="text-xs text-gray-400">{tr('drills.noDrillsTarget', 'No drills target {{category}} for this sport.', { category })}</p>
          ) : matches.map(d => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-1.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold', DIFFICULTY_BADGE[d.difficulty])}>{L.difficulty(d.difficulty)}</span>
                  {d.durationMinutes != null && <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500"><Clock size={9} /> {tr('drills.minutesShort', '{{count}}m', { count: d.durationMinutes })}</span>}
                </div>
              </div>
              {canAssign && (
                <button onClick={() => setAssigning(d)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex-shrink-0 cursor-pointer">
                  <Plus size={12} /> {tr('drills.assign', 'Assign')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <AssignDrillModal isOpen={!!assigning} onClose={() => setAssigning(null)} drill={assigning} players={[]} lockedPlayerId={goal.playerId} />
    </div>
  );
}
