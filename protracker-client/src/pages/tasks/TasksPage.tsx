import { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { TaskCard } from '../../components/tasks/TaskCard';
import { AssignTaskModal } from '../../components/tasks/AssignTaskModal';
import { groupTasks } from '../../components/tasks/taskUtils';
import { useCoachTasks, useDeleteTask } from '../../hooks/useTasks';
import { usePlayers } from '../../hooks/usePlayers';
import { useToast } from '../../context/ToastContext';
import { ClipboardList, Plus } from 'lucide-react';
import type { PlayerTask, TaskPriority } from '../../types';
import { clsx } from 'clsx';

const BUCKET_ACCENT: Record<string, string> = {
  Overdue: 'text-red-500',
  Today: 'text-indigo-500',
  'This Week': 'text-amber-500',
  Later: 'text-gray-500',
  Completed: 'text-green-500',
};

export function TasksPage() {
  const { addToast } = useToast();
  const { data: players = [] } = usePlayers();
  const [playerFilter, setPlayerFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: tasks = [], isLoading } = useCoachTasks({
    playerId: playerFilter ? Number(playerFilter) : undefined,
    priority: (priorityFilter || undefined) as TaskPriority | undefined,
    completed: showCompleted ? undefined : false,
  });

  const deleteTask = useDeleteTask();
  const [assignOpen, setAssignOpen] = useState(false);
  const [editTask, setEditTask] = useState<PlayerTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlayerTask | null>(null);

  const groups = groupTasks(tasks);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTask.mutateAsync(deleteTarget.id);
      addToast('Task deleted', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <PageWrapper
      title="Player Tasks"
      actions={
        <button
          onClick={() => { setEditTask(null); setAssignOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
        >
          <Plus size={16} /> Assign Task
        </button>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Player"
          value={playerFilter}
          onChange={e => setPlayerFilter(e.target.value)}
          options={[
            { value: '', label: 'All Players' },
            ...players.map(p => ({ value: String(p.id), label: p.fullName })),
          ]}
        />
        <Select
          label="Priority"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          options={[
            { value: '', label: 'All Priorities' },
            { value: 'High', label: 'High' },
            { value: 'Medium', label: 'Medium' },
            { value: 'Low', label: 'Low' },
          ]}
        />
        <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={e => setShowCompleted(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Show completed</span>
        </label>
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="No tasks yet"
          description="Assign drills and tasks to your players to track their progress."
          action={{ label: 'Assign Task', onClick: () => { setEditTask(null); setAssignOpen(true); } }}
        />
      ) : (
        <div className="space-y-6">
          {groups.map(({ bucket, tasks: bucketTasks }) => (
            <div key={bucket}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className={clsx('text-sm font-bold uppercase tracking-wide', BUCKET_ACCENT[bucket])}>{bucket}</h3>
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">
                  {bucketTasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {bucketTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showPlayer
                    onEdit={() => { setEditTask(task); setAssignOpen(true); }}
                    onDelete={() => setDeleteTarget(task)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AssignTaskModal
        isOpen={assignOpen}
        onClose={() => { setAssignOpen(false); setEditTask(null); }}
        players={players.map(p => ({ id: p.id, name: p.fullName }))}
        task={editTask}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Task"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleteTask.isPending}
      />
    </PageWrapper>
  );
}
