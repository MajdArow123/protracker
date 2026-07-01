import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { useCreateTask, useUpdateTask } from '../../hooks/useTasks';
import { CATEGORY_ORDER, PRIORITY_BADGE } from './taskUtils';
import type { PlayerTask, TaskPriority, TaskCategory } from '../../types';

interface PlayerOption { id: number; name: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  players: PlayerOption[];
  task?: PlayerTask | null;      // present → edit mode
  lockedPlayerId?: number;       // assigning from a specific player's page
}

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High'];

export function AssignTaskModal({ isOpen, onClose, players, task, lockedPlayerId }: Props) {
  const { addToast } = useToast();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const isEdit = !!task;

  const [playerId, setPlayerId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Training');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  // Reset the form whenever the modal opens (or the task being edited changes).
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (task) {
      setPlayerId(String(task.playerId));
      setTitle(task.title);
      setDescription(task.description ?? '');
      setCategory(task.category);
      setPriority(task.priority);
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    } else {
      setPlayerId(lockedPlayerId ? String(lockedPlayerId) : '');
      setTitle('');
      setDescription('');
      setCategory('Training');
      setPriority('Medium');
      setDueDate('');
    }
  }, [isOpen, task, lockedPlayerId]);

  const isSaving = createTask.isPending || updateTask.isPending;

  async function handleSubmit() {
    if (!playerId) { setError('Select a player'); return; }
    if (!title.trim()) { setError('Title is required'); return; }
    setError('');

    const payload = {
      playerId: Number(playerId),
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate || null,
      priority,
      category,
    };

    try {
      if (isEdit && task) {
        await updateTask.mutateAsync({ id: task.id, data: payload });
        addToast('Task updated', 'success');
      } else {
        await createTask.mutateAsync(payload);
        addToast('Task assigned', 'success');
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Task' : 'Assign Task'}>
      <div className="space-y-4">
        {!lockedPlayerId && (
          <Select
            label="Player"
            value={playerId}
            onChange={e => setPlayerId(e.target.value)}
            options={[
              { value: '', label: 'Select player…' },
              ...players.map(p => ({ value: String(p.id), label: p.name })),
            ]}
          />
        )}

        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 100 finishing reps" />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Details, sets/reps, focus points…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            value={category}
            onChange={e => setCategory(e.target.value as TaskCategory)}
            options={CATEGORY_ORDER.map(c => ({ value: c, label: c }))}
          />
          <Input label="Due date (optional)" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={clsx(
                  'flex-1 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer',
                  priority === p
                    ? clsx(PRIORITY_BADGE[p], 'border-transparent ring-2 ring-offset-1 dark:ring-offset-gray-800 ring-current')
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>{isEdit ? 'Save Changes' : 'Assign Task'}</Button>
        </div>
      </div>
    </Modal>
  );
}
