import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  Sparkles, Plus, Pencil, Trash2, Check, Star, CheckCircle2, Circle, Activity,
} from 'lucide-react';
import { Modal, ConfirmModal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { AILoadingPanel } from '../ui/AILoadingPanel';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../../context/ToastContext';
import {
  useInjuryRecoveryPlan, usePlayerRecoveryPlan, useGenerateRecoveryPlan, useCreateRecoveryPlan,
  useAddExercise, useUpdateExercise, useDeleteExercise, useCompleteExercise,
  useAddMilestone, useAchieveMilestone,
} from '../../hooks/useRecovery';
import type { RecoveryExercise, RecoveryExerciseCategory, RecoveryPlan } from '../../types';
import type { ExerciseInput } from '../../api/recoveryApi';

const CATEGORIES: RecoveryExerciseCategory[] = ['Mobility', 'Strength', 'Cardio', 'Flexibility', 'Balance', 'Ice', 'Heat', 'Rest'];

const CAT_STYLES: Record<RecoveryExerciseCategory, string> = {
  Mobility: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  Strength: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Cardio: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Flexibility: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Balance: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Ice: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Heat: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Rest: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const SEV_STYLES: Record<string, string> = {
  Severe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Moderate: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Minor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)}
          className={clsx(onChange && 'cursor-pointer')}>
          <Star size={16} className={clsx(n <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600')} />
        </button>
      ))}
    </div>
  );
}

// ── Complete-exercise modal (athlete) ────────────────────────────────────────
function CompleteExerciseModal({ exercise, isOpen, onClose }: { exercise: RecoveryExercise | null; isOpen: boolean; onClose: () => void }) {
  const { addToast } = useToast();
  const complete = useCompleteExercise();
  const [note, setNote] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  useEffect(() => { if (isOpen) { setNote(''); setDifficulty(3); } }, [isOpen, exercise?.id]);

  async function submit() {
    if (!exercise) return;
    try {
      await complete.mutateAsync({ exerciseId: exercise.id, data: { completedNote: note.trim() || undefined, difficultyRating: difficulty } });
      addToast('Exercise completed', 'success');
      onClose();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mark Exercise Complete">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">{exercise?.title}</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">How hard was it?</label>
          <Stars value={difficulty} onChange={setDifficulty} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="How did it feel?"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} isLoading={complete.isPending}>Confirm Complete</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add/edit exercise modal (coach) ──────────────────────────────────────────
function ExerciseModal({ planId, exercise, defaultWeek, isOpen, onClose }: {
  planId: number; exercise: RecoveryExercise | null; defaultWeek: number; isOpen: boolean; onClose: () => void;
}) {
  const { addToast } = useToast();
  const add = useAddExercise();
  const update = useUpdateExercise();
  const isEdit = !!exercise;
  const [form, setForm] = useState<ExerciseInput>({ title: '', week: defaultWeek, dayOfWeek: 'All', category: 'Mobility' });

  useEffect(() => {
    if (!isOpen) return;
    setForm(exercise
      ? { title: exercise.title, description: exercise.description ?? '', sets: exercise.sets, reps: exercise.reps, durationMinutes: exercise.durationMinutes, restSeconds: exercise.restSeconds, week: exercise.week, dayOfWeek: exercise.dayOfWeek, category: exercise.category }
      : { title: '', description: '', week: defaultWeek, dayOfWeek: 'All', category: 'Mobility' });
  }, [isOpen, exercise, defaultWeek]);

  function num(v: string): number | null { return v === '' ? null : Number(v); }

  async function submit() {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    try {
      if (isEdit && exercise) await update.mutateAsync({ exerciseId: exercise.id, data: form });
      else await add.mutateAsync({ planId, data: form });
      addToast(isEdit ? 'Exercise updated' : 'Exercise added', 'success');
      onClose();
    } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Exercise' : 'Add Exercise'}>
      <div className="space-y-4">
        <Input label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Hamstring stretch" />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input label="Week" type="number" min={1} value={String(form.week)} onChange={e => setForm(f => ({ ...f, week: Number(e.target.value) || 1 }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Day</label>
            <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {['All', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as RecoveryExerciseCategory }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Input label="Sets" type="number" min={0} value={form.sets == null ? '' : String(form.sets)} onChange={e => setForm(f => ({ ...f, sets: num(e.target.value) }))} />
          <Input label="Reps" type="number" min={0} value={form.reps == null ? '' : String(form.reps)} onChange={e => setForm(f => ({ ...f, reps: num(e.target.value) }))} />
          <Input label="Min" type="number" min={0} value={form.durationMinutes == null ? '' : String(form.durationMinutes)} onChange={e => setForm(f => ({ ...f, durationMinutes: num(e.target.value) }))} />
          <Input label="Rest(s)" type="number" min={0} value={form.restSeconds == null ? '' : String(form.restSeconds)} onChange={e => setForm(f => ({ ...f, restSeconds: num(e.target.value) }))} />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} isLoading={add.isPending || update.isPending}>{isEdit ? 'Save' : 'Add'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export function RecoveryPlanModal({ isOpen, onClose, injuryId, playerId, isCoach }: {
  isOpen: boolean; onClose: () => void; injuryId?: number; playerId?: number; isCoach: boolean;
}) {
  const { addToast } = useToast();
  const injuryQuery = useInjuryRecoveryPlan(injuryId ?? null);
  const playerQuery = usePlayerRecoveryPlan(injuryId ? null : playerId ?? null);
  const plan: RecoveryPlan | null | undefined = injuryId ? injuryQuery.data : playerQuery.data;
  const isLoading = injuryId ? injuryQuery.isLoading : playerQuery.isLoading;

  const generate = useGenerateRecoveryPlan();
  const createPlan = useCreateRecoveryPlan();
  const deleteExercise = useDeleteExercise();
  const achieveMilestone = useAchieveMilestone();
  const addMilestone = useAddMilestone();

  const [week, setWeek] = useState(1);
  const [exModalOpen, setExModalOpen] = useState(false);
  const [editEx, setEditEx] = useState<RecoveryExercise | null>(null);
  const [completeEx, setCompleteEx] = useState<RecoveryExercise | null>(null);
  const [deleteEx, setDeleteEx] = useState<RecoveryExercise | null>(null);

  useEffect(() => { if (plan) setWeek(plan.currentWeek || 1); }, [plan?.id]); // eslint-disable-line

  async function handleGenerate() {
    if (!injuryId) return;
    try { await generate.mutateAsync(injuryId); addToast('Recovery plan generated', 'success'); }
    catch (err) { addToast(err instanceof Error ? err.message : 'Generation failed', 'error'); }
  }
  async function handleCreateManual() {
    if (!injuryId) return;
    try { await createPlan.mutateAsync({ injuryId, data: { title: '', estimatedWeeks: 4 } }); addToast('Plan created — add exercises', 'success'); }
    catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  }
  async function handleAddMilestone() {
    if (!plan) return;
    const title = window.prompt('Milestone title (e.g. "Walk without pain")');
    if (!title?.trim()) return;
    try { await addMilestone.mutateAsync({ planId: plan.id, data: { title: title.trim(), targetWeek: week } }); }
    catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); }
  }

  const weeks = plan ? Array.from({ length: Math.max(plan.estimatedWeeks, ...plan.exercises.map(e => e.week), 1) }, (_, i) => i + 1) : [];
  const weekExercises = plan?.exercises.filter(e => e.week === week) ?? [];
  const pct = plan && plan.totalExercises > 0 ? Math.round((plan.completedExercises / plan.totalExercises) * 100) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recovery Program" size="xl">
      {isLoading ? (
        <div className="py-12 flex justify-center"><Spinner /></div>
      ) : generate.isPending ? (
        <AILoadingPanel
          primaryText="Building recovery program…"
          messages={['Analyzing injury type & severity…', 'Considering sport & position…', 'Planning week-by-week exercises…', 'Setting recovery milestones…']}
          estimatedSeconds={40}
        />
      ) : !plan ? (
        isCoach ? (
          <div className="space-y-4 py-4">
            <EmptyState icon={<Activity size={32} />} title="No recovery program yet" description="Generate one with AI or build it manually." size="sm" />
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={handleCreateManual} isLoading={createPlan.isPending}><Plus size={15} className="mr-1" /> Create Manually</Button>
              <Button onClick={handleGenerate}><Sparkles size={15} className="mr-1" /> Generate with AI</Button>
            </div>
          </div>
        ) : (
          <EmptyState icon={<Activity size={32} />} title="No recovery program" description="Your coach hasn't set up a recovery program yet." size="sm" />
        )
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">{plan.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-gray-600 dark:text-gray-300">{plan.playerName}</span>
                <span className="text-gray-300">·</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">{plan.injuryType}{plan.bodyPart ? ` (${plan.bodyPart})` : ''}</span>
                <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', SEV_STYLES[plan.severity])}>{plan.severity}</span>
              </div>
            </div>
            {isCoach && (
              <div className="flex items-center gap-2">
                <button onClick={handleGenerate} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-all cursor-pointer">
                  <Sparkles size={13} /> Regenerate
                </button>
              </div>
            )}
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              <span>Week {plan.currentWeek} of {plan.estimatedWeeks}</span>
              <span>{plan.completedExercises}/{plan.totalExercises} exercises · {pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Milestones timeline */}
          {(plan.milestones.length > 0 || isCoach) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Milestones</p>
                {isCoach && <button onClick={handleAddMilestone} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">+ Add</button>}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {plan.milestones.map(m => (
                  <button key={m.id} disabled={!isCoach} onClick={() => isCoach && achieveMilestone.mutate(m.id)}
                    className={clsx('flex-shrink-0 w-40 rounded-xl border p-2.5 text-left transition-all', isCoach && 'cursor-pointer hover:border-indigo-400',
                      m.isAchieved ? 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-800')}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {m.isAchieved ? <CheckCircle2 size={15} className="text-green-500" /> : <Circle size={15} className="text-gray-300 dark:text-gray-600" />}
                      <span className="text-[10px] font-semibold text-gray-400">Week {m.targetWeek}</span>
                    </div>
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">{m.title}</p>
                  </button>
                ))}
                {plan.milestones.length === 0 && <p className="text-xs text-gray-400">No milestones yet.</p>}
              </div>
            </div>
          )}

          {/* Week tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
            {weeks.map(w => (
              <button key={w} onClick={() => setWeek(w)}
                className={clsx('px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-all cursor-pointer',
                  week === w ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
                Week {w}
              </button>
            ))}
          </div>

          {/* Exercises for selected week */}
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {isCoach && (
              <button onClick={() => { setEditEx(null); setExModalOpen(true); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-all cursor-pointer">
                <Plus size={13} /> Add Exercise to Week {week}
              </button>
            )}
            {weekExercises.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No exercises for week {week}.</p>
            ) : weekExercises.map(ex => (
              <div key={ex.id} className={clsx('rounded-xl border p-3', ex.isCompleted ? 'border-green-200 dark:border-green-900 bg-green-50/40 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-800')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', CAT_STYLES[ex.category])}>{ex.category}</span>
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">{ex.dayOfWeek}</span>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{ex.title}</h4>
                  </div>
                  {isCoach && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditEx(ex); setExModalOpen(true); }} className="p-1 rounded text-gray-400 hover:text-indigo-500 cursor-pointer"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteEx(ex)} className="p-1 rounded text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                {ex.description && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{ex.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  {ex.sets != null && ex.reps != null && <span>{ex.sets}×{ex.reps}</span>}
                  {ex.durationMinutes != null && <span>{ex.durationMinutes} min</span>}
                  {ex.restSeconds != null && <span>{ex.restSeconds}s rest</span>}
                </div>
                {ex.isCompleted ? (
                  <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold"><Check size={13} /> Done</span>
                    {ex.difficultyRating != null && <Stars value={ex.difficultyRating} />}
                    {ex.completedNote && <span className="text-gray-500 italic">“{ex.completedNote}”</span>}
                  </div>
                ) : (
                  <button onClick={() => setCompleteEx(ex)}
                    className="mt-2 w-full py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition-all cursor-pointer">
                    Mark Complete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {plan && (
        <>
          <ExerciseModal planId={plan.id} exercise={editEx} defaultWeek={week} isOpen={exModalOpen} onClose={() => { setExModalOpen(false); setEditEx(null); }} />
          <CompleteExerciseModal exercise={completeEx} isOpen={!!completeEx} onClose={() => setCompleteEx(null)} />
          <ConfirmModal isOpen={!!deleteEx} onClose={() => setDeleteEx(null)}
            onConfirm={async () => { if (!deleteEx) return; try { await deleteExercise.mutateAsync(deleteEx.id); addToast('Exercise deleted', 'success'); } catch (err) { addToast(err instanceof Error ? err.message : 'Failed', 'error'); } finally { setDeleteEx(null); } }}
            title="Delete Exercise" message={`Delete "${deleteEx?.title}"?`} confirmLabel="Delete" isLoading={deleteExercise.isPending} />
        </>
      )}
    </Modal>
  );
}
