import { useState, useEffect } from 'react';
import { Plus, X, Lock, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useStatCategories } from '../../hooks/useSports';
import { useCreateGoal, useUpdateGoal } from '../../hooks/useGoals';
import { useToast } from '../../context/ToastContext';
import { CATEGORY_ORDER, PRIORITY_ORDER, CATEGORY_BADGE, PRIORITY_BADGE } from './goalUtils';
import type { PersonalGoal, GoalCategory, GoalPriority } from '../../types';
import type { CreateGoalMilestoneInput } from '../../api/goalsApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  playerId: number;
  sportId?: number;
  goal?: PersonalGoal | null;
  // Whether the acting user owns this player (only owners can make a goal private).
  canBePrivate: boolean;
}

function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export function GoalFormModal({ isOpen, onClose, playerId, sportId, goal, canBePrivate }: Props) {
  const { addToast } = useToast();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const { data: statCategories = [] } = useStatCategories(sportId);
  const isEdit = !!goal;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('Performance');
  const [priority, setPriority] = useState<GoalPriority>('Medium');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [unit, setUnit] = useState('');
  const [linkedStatCategoryId, setLinkedStatCategoryId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [milestones, setMilestones] = useState<CreateGoalMilestoneInput[]>([]);
  const [msTitle, setMsTitle] = useState('');
  const [msTarget, setMsTarget] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitle(goal?.title ?? '');
    setDescription(goal?.description ?? '');
    setCategory(goal?.category ?? 'Performance');
    setPriority(goal?.priority ?? 'Medium');
    setTargetValue(goal?.targetValue != null ? String(goal.targetValue) : '');
    setCurrentValue(goal?.currentValue != null ? String(goal.currentValue) : '');
    setUnit(goal?.unit ?? '');
    setLinkedStatCategoryId(goal?.linkedStatCategoryId ?? '');
    setStartDate(toDateInput(goal?.startDate));
    setTargetDate(toDateInput(goal?.targetDate));
    setIsPrivate(goal?.isPrivate ?? false);
    setMilestones([]);
    setMsTitle('');
    setMsTarget('');
  }, [isOpen, goal]);

  function addMilestone() {
    if (!msTitle.trim()) return;
    setMilestones(prev => [...prev, {
      title: msTitle.trim(),
      targetValue: msTarget.trim() ? Number(msTarget) : null,
    }]);
    setMsTitle('');
    setMsTarget('');
  }

  async function handleSubmit() {
    if (!title.trim()) {
      addToast('A goal title is required', 'error');
      return;
    }
    const numOrNull = (s: string) => (s.trim() ? Number(s) : null);
    const common = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority,
      targetValue: numOrNull(targetValue),
      currentValue: numOrNull(currentValue),
      unit: unit.trim() || null,
      linkedStatCategoryId: category === 'Performance' && linkedStatCategoryId ? Number(linkedStatCategoryId) : null,
      startDate: startDate || null,
      targetDate: targetDate || null,
      isPrivate: canBePrivate && isPrivate,
    };

    try {
      if (isEdit && goal) {
        await updateGoal.mutateAsync({ id: goal.id, data: { ...common, status: goal.status } });
        addToast('Goal updated', 'success');
      } else {
        await createGoal.mutateAsync({ ...common, playerId, milestones });
        addToast('Goal created', 'success');
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save goal', 'error');
    }
  }

  const saving = createGoal.isPending || updateGoal.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Goal' : 'New Goal'} size="lg">
      <div className="space-y-5">
        <div>
          <Input
            label="Goal"
            placeholder="e.g. Improve my passing score from 6 to 8"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        {/* Category pills */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                  category === c ? CATEGORY_BADGE[c] + ' ring-2 ring-offset-1 ring-current dark:ring-offset-gray-800' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:opacity-80',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Priority pills */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</p>
          <div className="flex gap-2">
            {PRIORITY_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={clsx(
                  'px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                  priority === p ? PRIORITY_BADGE[p] + ' ring-2 ring-offset-1 ring-current dark:ring-offset-gray-800' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:opacity-80',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Measurable target */}
        <div className="grid grid-cols-3 gap-3">
          <Input label="Current" type="number" step="0.1" placeholder="6.0" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
          <Input label="Target" type="number" step="0.1" placeholder="8.0" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          <Input label="Unit" placeholder="score, kg, min" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>

        {/* Link to assessment category — enables auto-tracking from assessments */}
        {category === 'Performance' && statCategories.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Link to assessment category <span className="text-gray-400 font-normal">(auto-tracks from assessments)</span>
            </label>
            <select
              value={linkedStatCategoryId}
              onChange={(e) => setLinkedStatCategoryId(e.target.value ? Number(e.target.value) : '')}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">None</option>
              {statCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Target date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="More detail about this goal…"
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none"
          />
        </div>

        {/* Privacy toggle (owner only) */}
        {canBePrivate && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Visibility</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={clsx('flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer',
                  !isPrivate ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'border-gray-300 dark:border-gray-600 text-gray-500')}
              >
                <Users size={15} /> Visible to coach
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={clsx('flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer',
                  isPrivate ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'border-gray-300 dark:border-gray-600 text-gray-500')}
              >
                <Lock size={15} /> Private (only you)
              </button>
            </div>
          </div>
        )}

        {/* Milestones (create only) */}
        {!isEdit && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Milestones</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Add checkpoints to track progress along the way.</p>
            {milestones.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {milestones.map((m, i) => (
                  <li key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-gray-700 dark:text-gray-200">{m.title}{m.targetValue != null ? ` — ${m.targetValue}` : ''}</span>
                    <button type="button" onClick={() => setMilestones(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 cursor-pointer">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(); } }}
                placeholder="Milestone title"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
              <input
                value={msTarget}
                onChange={(e) => setMsTarget(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(); } }}
                type="number"
                step="0.1"
                placeholder="Target"
                className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addMilestone}><Plus size={15} /></Button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Goal'}</Button>
        </div>
      </div>
    </Modal>
  );
}
