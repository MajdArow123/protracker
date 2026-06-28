import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { usePlayer } from '../../hooks/usePlayers';
import { usePlayerImprovementPlans, useCreateImprovementPlan, useUpdateImprovementPlan } from '../../hooks/useImprovement';
import { ArrowLeft, Edit2, Plus } from 'lucide-react';
import type { ImprovementPlan } from '../../types';

const TEXTAREA_CLS = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none';

const PLAN_FIELDS: { key: keyof ImprovementPlan; label: string; placeholder: string }[] = [
  { key: 'weeklyGoals', label: 'Weekly Goals', placeholder: 'Goals for this week…' },
  { key: 'trainingRecommendations', label: 'Training Recommendations', placeholder: 'Recommended training routines…' },
  { key: 'skillTargets', label: 'Skill Targets', placeholder: 'Specific skills to develop…' },
  { key: 'sportSpecificDrills', label: 'Sport-Specific Drills', placeholder: 'Drills tailored to this sport…' },
  { key: 'positionFocus', label: 'Position Focus', placeholder: 'Responsibilities for this position…' },
  { key: 'coachNotes', label: 'Coach Notes', placeholder: 'Private notes for coaches…' },
];

type FormValues = Partial<Record<keyof ImprovementPlan, string>>;

export function ImprovementPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: player, isLoading: loadingPlayer } = usePlayer(playerId);
  const { data: plans = [], isLoading: loadingPlans } = usePlayerImprovementPlans(playerId);
  const createPlan = useCreateImprovementPlan();
  const updatePlan = useUpdateImprovementPlan();

  const [editing, setEditing] = useState<ImprovementPlan | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [values, setValues] = useState<FormValues>({});

  useEffect(() => {
    if (editing) {
      const v: FormValues = {};
      PLAN_FIELDS.forEach(f => { v[f.key] = String(editing[f.key] ?? ''); });
      setValues(v);
    } else if (showNew) {
      const v: FormValues = {};
      PLAN_FIELDS.forEach(f => { v[f.key] = ''; });
      setValues(v);
    }
  }, [editing, showNew]);

  const set = (key: keyof ImprovementPlan) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setValues(prev => ({ ...prev, [key]: e.target.value }));

  async function save() {
    const payload = Object.fromEntries(
      PLAN_FIELDS.map(f => [f.key, values[f.key] || undefined])
    );

    try {
      if (editing) {
        await updatePlan.mutateAsync({ id: editing.id, data: payload });
        showToast('Plan updated', 'success');
        setEditing(null);
      } else {
        await createPlan.mutateAsync({ ...payload, playerId } as Parameters<typeof createPlan.mutateAsync>[0]);
        showToast('Plan created', 'success');
        setShowNew(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  const isLoading = createPlan.isPending || updatePlan.isPending;

  if (loadingPlayer || loadingPlans) return <PageSpinner />;

  const isFormOpen = !!editing || showNew;

  return (
    <PageWrapper
      title={`Improvement Plan — ${player?.fullName ?? ''}`}
      actions={
        <div className="flex gap-2">
          {!isFormOpen && (
            <Button size="sm" onClick={() => { setShowNew(true); setEditing(null); }}>
              <Plus size={16} /> New Plan
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`/players/${id}`)}>
            <ArrowLeft size={16} /> Back
          </Button>
        </div>
      }
    >
      {isFormOpen && (
        <div className="max-w-2xl space-y-6 mb-8">
          <Card header={editing ? 'Edit Improvement Plan' : 'New Improvement Plan'}>
            <div className="space-y-4">
              {PLAN_FIELDS.map(f => (
                <div key={String(f.key)}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <textarea
                    value={values[f.key] ?? ''}
                    onChange={set(f.key)}
                    rows={3}
                    placeholder={f.placeholder}
                    className={TEXTAREA_CLS}
                  />
                </div>
              ))}
            </div>
          </Card>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setEditing(null); setShowNew(false); }}>
              Cancel
            </Button>
            <Button onClick={save} isLoading={isLoading}>
              {editing ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-2xl space-y-4">
        {plans.length === 0 && !isFormOpen ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="mb-4">No improvement plan yet.</p>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={16} /> Create First Plan
            </Button>
          </div>
        ) : (
          plans.map((plan, i) => (
            <Card key={plan.id}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {i === 0 ? 'Latest Plan' : `Plan — ${plan.createdDate}`}
                  </p>
                  <p className="text-xs text-gray-500">{plan.createdDate}</p>
                  {plan.isAIGenerated && (
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">AI Generated</span>
                  )}
                </div>
                {i === 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditing(plan); setShowNew(false); }}
                  >
                    <Edit2 size={16} />
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {PLAN_FIELDS.map(f => plan[f.key] ? (
                  <div key={String(f.key)}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{f.label}</p>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{String(plan[f.key])}</p>
                  </div>
                ) : null)}
              </div>
            </Card>
          ))
        )}
      </div>
    </PageWrapper>
  );
}
