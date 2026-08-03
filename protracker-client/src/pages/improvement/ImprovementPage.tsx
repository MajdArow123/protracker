import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/Spinner';
import { AutoSaveStatus } from '../../components/ui/AutoSaveStatus';
import { AILoadingPanel } from '../../components/ui/AILoadingPanel';
import { AIDataSourcesNote } from '../../components/evidence/AIDataSourcesNote';
import { useToast } from '../../context/useToast';
import { usePlayer } from '../../hooks/usePlayers';
import { usePlayerImprovementPlans, useCreateImprovementPlan, useUpdateImprovementPlan } from '../../hooks/useImprovement';
import { useGenerateImprovementPlan } from '../../hooks/useAI';
import { useAutoSave } from '../../hooks/useAutoSave';
import { ArrowLeft, Edit2, Plus, Sparkles, Lightbulb } from 'lucide-react';
import { clsx } from 'clsx';
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

function DotLoader() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 bg-current rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export function ImprovementPage() {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const { data: player, isLoading: loadingPlayer } = usePlayer(playerId);
  const { data: plans = [], isLoading: loadingPlans } = usePlayerImprovementPlans(playerId);
  const createPlan = useCreateImprovementPlan();
  const updatePlan = useUpdateImprovementPlan();
  const generateAI = useGenerateImprovementPlan();

  const [editing, setEditing] = useState<ImprovementPlan | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [isAIForm, setIsAIForm] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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

  async function handleGenerateAI() {
    setAiError(null);
    try {
      const plan = await generateAI.mutateAsync(playerId);
      setEditing(plan);
      setShowNew(false);
      setIsAIForm(true);
      showToast('AI plan generated! Review and save changes.', 'success');
    } catch {
      setAiError('AI generation failed. Please try again.');
    }
  }

  function buildPlanPayload() {
    return Object.fromEntries(PLAN_FIELDS.map(f => [f.key, values[f.key] || undefined]));
  }

  async function autoSavePlan() {
    if (!editing) return;
    await updatePlan.mutateAsync({ id: editing.id, data: buildPlanPayload() });
  }

  const { status: autoSaveStatus, flush: flushPlan } = useAutoSave(!!editing, values, autoSavePlan);

  async function createNewPlan() {
    const payload = buildPlanPayload();
    try {
      await createPlan.mutateAsync({ ...payload, playerId } as Parameters<typeof createPlan.mutateAsync>[0]);
      showToast('Plan created', 'success');
      setShowNew(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  async function done() {
    if (editing) {
      await flushPlan();
      setEditing(null);
      setIsAIForm(false);
    } else {
      await createNewPlan();
    }
  }

  const isSaving = createPlan.isPending || updatePlan.isPending;
  const isGenerating = generateAI.isPending;

  if (loadingPlayer || loadingPlans) return <PageSpinner />;

  const isFormOpen = !!editing || showNew;

  return (
    <PageWrapper
      title={`Improvement Plan — ${player?.fullName ?? ''}`}
      actions={
        <div className="flex gap-2 flex-wrap">
          {!isFormOpen && (
            <>
              <button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer',
                  'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500',
                  'shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  isGenerating && 'animate-pulse'
                )}
              >
                <Sparkles size={15} />
                {isGenerating ? <span className="flex items-center">Claude is thinking<DotLoader /></span> : 'Generate with AI'}
              </button>
              <Button size="sm" onClick={() => { setShowNew(true); setEditing(null); setIsAIForm(false); }}>
                <Plus size={16} /> New Plan
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(`/players/${id}`)}>
            <ArrowLeft size={16} /> Back
          </Button>
        </div>
      }
    >
      {aiError && (
        <div className="max-w-2xl mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          {aiError}
          <button onClick={handleGenerateAI} className="ml-auto text-xs font-semibold underline cursor-pointer">Retry</button>
        </div>
      )}

      {!isGenerating && (
        <div className="max-w-2xl mb-4">
          <AIDataSourcesNote playerId={playerId} />
        </div>
      )}

      {isGenerating && (
        <div className="max-w-2xl mb-4">
          <AILoadingPanel
            compact
            primaryText="Generating improvement plan..."
            messages={[
              'Analyzing player data...',
              'Identifying key areas for growth...',
              'Building training recommendations...',
              'Finalizing the plan...',
            ]}
            estimatedSeconds={12}
          />
        </div>
      )}

      {isFormOpen && (
        <div className="max-w-2xl space-y-6 mb-8">
          <Card header={
            <div className="flex items-center gap-2">
              {editing ? 'Edit Improvement Plan' : 'New Improvement Plan'}
              {isAIForm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-semibold border border-violet-200 dark:border-violet-700">
                  <Sparkles size={10} /> AI Generated
                </span>
              )}
            </div>
          }>
            {isAIForm && (
              <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 text-xs text-violet-700 dark:text-violet-300">
                <Lightbulb size={14} className="mt-0.5 flex-shrink-0" />
                <span>Review the AI-generated plan below and edit any fields before saving. Clicking Save will update it with your edits.</span>
              </div>
            )}
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
          <div className="flex justify-between gap-3">
            {isAIForm && (
              <button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={14} />
                {isGenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            )}
            <div className="flex items-center gap-3 ml-auto">
              {editing && <AutoSaveStatus status={autoSaveStatus} />}
              <Button variant="secondary" onClick={() => { setEditing(null); setShowNew(false); setIsAIForm(false); }}>Cancel</Button>
              <Button onClick={done} isLoading={isSaving}>{editing ? 'Done' : 'Create Plan'}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl space-y-4">
        {plans.length === 0 && !isFormOpen ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="mb-4">No improvement plan yet.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer disabled:opacity-60"
              >
                <Sparkles size={15} /> {isGenerating ? 'Generating…' : 'Generate with AI'}
              </button>
              <Button onClick={() => setShowNew(true)}><Plus size={16} /> Create Manually</Button>
            </div>
          </div>
        ) : (
          plans.map((plan, i) => (
            <Card key={plan.id}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {i === 0 ? 'Latest Plan' : `Plan — ${new Date(plan.createdDate).toLocaleDateString()}`}
                    </p>
                    {plan.isAIGenerated && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-semibold border border-violet-200 dark:border-violet-700">
                        <Sparkles size={9} /> AI
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{new Date(plan.createdDate).toLocaleDateString()}</p>
                </div>
                {i === 0 && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(plan); setShowNew(false); setIsAIForm(false); }}>
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
