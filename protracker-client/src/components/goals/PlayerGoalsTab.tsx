import { useState } from 'react';
import { Target, Plus, Sparkles } from 'lucide-react';
import { GoalCard } from './GoalCard';
import { GoalFormModal } from './GoalFormModal';
import { LogProgressModal } from './LogProgressModal';
import { AIGoalSuggestionsModal } from './AIGoalSuggestionsModal';
import { usePlayerGoals } from '../../hooks/useGoals';
import { EmptyState } from '../ui/EmptyState';
import { CardListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import type { PersonalGoal } from '../../types';

interface Props {
  playerId: number;
  sportId?: number;
}

// Coach view of a player's (non-private) goals on the player detail page. Coaches can add,
// edit and log progress; private goals never appear here.
export function PlayerGoalsTab({ playerId, sportId }: Props) {
  const query = usePlayerGoals(playerId);
  const goals = query.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalGoal | null>(null);
  const [logging, setLogging] = useState<PersonalGoal | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  function openNew() { setEditing(null); setFormOpen(true); }

  if (query.isLoading) return <CardListSkeleton count={2} />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {goals.length} {goals.length === 1 ? 'goal' : 'goals'} · private goals are hidden from coaches
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 cursor-pointer">
            <Sparkles size={15} /> Suggest with AI
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">
            <Plus size={15} /> New Goal
          </button>
        </div>
      </div>

      {goals.length === 0 ? (
        <EmptyState icon={<Target />} title="No goals yet" description="Set a goal for this player to start tracking their progress."
          action={{ label: 'New Goal', onClick: openNew }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map(g => (
            <GoalCard key={g.id} goal={g} canManage onEdit={(goal) => { setEditing(goal); setFormOpen(true); }} onLogProgress={setLogging} />
          ))}
        </div>
      )}

      <GoalFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} playerId={playerId} sportId={sportId} goal={editing} canBePrivate={false} />
      <LogProgressModal isOpen={!!logging} onClose={() => setLogging(null)} goal={logging} />
      <AIGoalSuggestionsModal isOpen={aiOpen} onClose={() => setAiOpen(false)} players={[]} lockedPlayerId={playerId} />
    </div>
  );
}
