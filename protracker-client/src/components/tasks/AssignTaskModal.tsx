import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useToast } from '../../context/ToastContext';
import { useCreateTask, useUpdateTask } from '../../hooks/useTasks';
import { CATEGORY_ORDER, PRIORITY_BADGE, CATEGORY_BADGE, PRIORITY_BORDER, formatDate } from './taskUtils';
import type { PlayerTask, TaskPriority, TaskCategory } from '../../types';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

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
  const { t } = useTranslation();
  const L = useDynamicLabels();
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
    if (!playerId) { setError(t('tasks.selectPlayerError', 'Select a player')); return; }
    if (!title.trim()) { setError(t('tasks.titleRequired', 'Title is required')); return; }
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
        addToast(t('tasks.taskUpdated', 'Task updated'), 'success');
      } else {
        await createTask.mutateAsync(payload);
        addToast(t('tasks.taskAssigned', 'Task assigned'), 'success');
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.saveFailed', 'Save failed'), 'error');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('tasks.editTaskTitle', 'Edit Task') : t('tasks.assignTask', 'Assign Task')}>
      <div className="space-y-4">
        {!lockedPlayerId && (
          <Select
            label={t('tasks.player', 'Player')}
            value={playerId}
            onChange={e => setPlayerId(e.target.value)}
            options={[
              { value: '', label: t('tasks.selectPlayer', 'Select player…') },
              ...players.map(p => ({ value: String(p.id), label: p.name })),
            ]}
          />
        )}

        <Input label={t('common.title', 'Title')} value={title} onChange={e => setTitle(e.target.value)} placeholder={t('tasks.titlePlaceholder', 'e.g. 100 finishing reps')} />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.description', 'Description')}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder={t('tasks.descriptionPlaceholder', 'Details, sets/reps, focus points…')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('common.category', 'Category')}
            value={category}
            onChange={e => setCategory(e.target.value as TaskCategory)}
            options={CATEGORY_ORDER.map(c => ({ value: c, label: L.category(c) }))}
          />
          <Input label={t('tasks.dueDateOptional', 'Due date (optional)')} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('common.priority', 'Priority')}</label>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={clsx(
                  'py-3 rounded-xl text-sm font-bold border-2 border-l-4 transition-all cursor-pointer',
                  PRIORITY_BORDER[p],
                  priority === p
                    ? clsx(PRIORITY_BADGE[p], 'border-current')
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
                )}
              >
                {L.priority(p)}
              </button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        {title.trim() && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('tasks.preview', 'Preview')}</label>
            <div className={clsx('rounded-xl border border-l-4 bg-gray-50 dark:bg-gray-800/50 p-3', PRIORITY_BORDER[priority])}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm text-gray-900 dark:text-white">{title.trim()}</p>
                <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', CATEGORY_BADGE[category])}>{L.category(category)}</span>
                <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', PRIORITY_BADGE[priority])}>{L.priority(priority)}</span>
              </div>
              {description.trim() && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{description.trim()}</p>}
              {dueDate && <p className="text-xs text-gray-500 mt-1">{t('tasks.duePrefix', 'Due ')}{formatDate(dueDate)}</p>}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>{isEdit ? t('common.saveChanges', 'Save Changes') : t('tasks.assignTask', 'Assign Task')}</Button>
        </div>
      </div>
    </Modal>
  );
}
