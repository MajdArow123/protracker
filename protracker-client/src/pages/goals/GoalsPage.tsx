import { useState, useMemo } from 'react';
import { Target, Plus, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardListSkeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { GoalCard } from '../../components/goals/GoalCard';
import { GoalFormModal } from '../../components/goals/GoalFormModal';
import { LogProgressModal } from '../../components/goals/LogProgressModal';
import { AIGoalSuggestionsModal } from '../../components/goals/AIGoalSuggestionsModal';
import { matchesFilter, type GoalFilter } from '../../components/goals/goalUtils';
import { useMyGoals, usePlayerGoals } from '../../hooks/useGoals';
import { useMyPlayer, usePlayers } from '../../hooks/usePlayers';
import { useAuth } from '../../context/useAuth';
import type { PersonalGoal } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

const FILTERS: GoalFilter[] = ['All', 'Active', 'Achieved', 'Paused'];

// Stable fallback: an inline `?? []` mints a new array every render, which
// defeats every useMemo keyed on `goals`.
const NO_GOALS: PersonalGoal[] = [];

export function GoalsPage() {
  const { t } = useTranslation();
  const L = useDynamicLabels();
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const isSolo = user?.role === 'SoloAthlete';

  // Coach picks a player; athlete/solo are locked to their own player.
  const { data: allPlayers = [] } = usePlayers(isCoach);
  const { data: myPlayer } = useMyPlayer(!isCoach);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | ''>('');

  const activePlayerId = isCoach ? (selectedPlayerId || undefined) : myPlayer?.id;
  const sportId = isCoach
    ? allPlayers.find(p => p.id === selectedPlayerId)?.sportId
    : myPlayer?.sportId;

  const myGoalsQuery = useMyGoals(!isCoach);
  const playerGoalsQuery = usePlayerGoals(isCoach ? activePlayerId : undefined, isCoach);
  const goalsQuery = isCoach ? playerGoalsQuery : myGoalsQuery;
  const goals = goalsQuery.data ?? NO_GOALS;

  const [filter, setFilter] = useState<GoalFilter>('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalGoal | null>(null);
  const [logging, setLogging] = useState<PersonalGoal | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const filtered = useMemo(() => goals.filter(g => matchesFilter(g, filter)), [goals, filter]);

  // Athlete/solo own their goals; coach manages the (non-private) goals shown for their player.
  const canManage = !isCoach || !!activePlayerId;
  const canBePrivate = !isCoach; // only the owning athlete can make a goal private
  const showAI = isCoach || isSolo; // team athletes don't have AI access

  const counts = useMemo(() => ({
    All: goals.length,
    Active: goals.filter(g => g.status === 'Active').length,
    Achieved: goals.filter(g => g.status === 'Achieved').length,
    Paused: goals.filter(g => g.status === 'Paused').length,
  }), [goals]);

  const title = isCoach ? t('goals.playerGoals', 'Player Goals') : t('goals.title', 'My Goals');

  const filterLabel = (f: GoalFilter) => f === 'All' ? t('common.all', 'All') : L.status(f);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(g: PersonalGoal) {
    setEditing(g);
    setFormOpen(true);
  }

  const canCreate = !!activePlayerId;

  const actions = (
    <div className="flex items-center gap-2">
      {showAI && (
        <Button variant="secondary" onClick={() => setAiOpen(true)} disabled={!canCreate}>
          <Sparkles size={16} className="mr-1.5" /> {t('goals.suggestWithAI', 'Suggest with AI')}
        </Button>
      )}
      <Button onClick={openNew} disabled={!canCreate}>
        <Plus size={16} className="mr-1.5" /> {t('goals.newGoal', 'New Goal')}
      </Button>
    </div>
  );

  return (
    <PageWrapper title={title} actions={actions}>
      {/* Coach player picker */}
      {isCoach && (
        <div className="mb-5">
          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value ? Number(e.target.value) : '')}
            className="w-full sm:w-72 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">{t('goals.selectPlayer', 'Select a player…')}</option>
            {allPlayers.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>
      )}

      {isCoach && !activePlayerId ? (
        <EmptyState icon={<Target />} title={t('goals.selectPlayerTitle', 'Select a player')} description={t('goals.selectPlayerDesc', 'Choose a player above to view and set their goals.')} />
      ) : goalsQuery.isLoading ? (
        <CardListSkeleton count={3} />
      ) : goalsQuery.isError ? (
        <ErrorState onRetry={() => goalsQuery.refetch()} />
      ) : (
        <>
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer',
                  filter === f
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
                )}
              >
                {filterLabel(f)} <span className="opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Target />}
              title={goals.length === 0 ? t('goals.noGoals', 'No goals yet') : t('goals.noFilteredGoals', 'No {{filter}} goals', { filter: filterLabel(filter).toLowerCase() })}
              description={goals.length === 0 ? t('goals.emptyDesc', 'Set your first goal to start tracking your progress.') : t('goals.tryDifferentFilter', 'Try a different filter.')}
              action={goals.length === 0 && canCreate ? { label: t('goals.newGoal', 'New Goal'), onClick: openNew } : undefined}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  canManage={canManage}
                  sportId={sportId}
                  onEdit={openEdit}
                  onLogProgress={setLogging}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activePlayerId && (
        <GoalFormModal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          playerId={activePlayerId}
          sportId={sportId}
          goal={editing}
          canBePrivate={canBePrivate}
        />
      )}
      <LogProgressModal isOpen={!!logging} onClose={() => setLogging(null)} goal={logging} />
      {showAI && activePlayerId && (
        <AIGoalSuggestionsModal
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
          players={isCoach ? allPlayers.map(p => ({ id: p.id, name: p.fullName })) : []}
          lockedPlayerId={activePlayerId}
        />
      )}
    </PageWrapper>
  );
}
