import { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { TaskCard } from '../../components/tasks/TaskCard';
import { AssignTaskModal } from '../../components/tasks/AssignTaskModal';
import { AITaskSuggestionsModal } from '../../components/tasks/AITaskSuggestionsModal';
import { groupTasks, taskStats, CATEGORY_ORDER } from '../../components/tasks/taskUtils';
import { useCoachTasks, useDeleteTask } from '../../hooks/useTasks';
import { usePlayers } from '../../hooks/usePlayers';
import { useToast } from '../../context/ToastContext';
import { ClipboardList, Plus, ChevronDown, X, Sparkles } from 'lucide-react';
import type { PlayerTask, TaskPriority, TaskCategory } from '../../types';
import { clsx } from 'clsx';

const BUCKET_ACCENT: Record<string, string> = {
  Overdue: 'text-red-500',
  Today: 'text-amber-500',
  'This Week': 'text-blue-500',
  Later: 'text-gray-500',
  Completed: 'text-green-500',
};

type StatusFilter = 'all' | 'pending' | 'completed';

export function TasksPage() {
  const { addToast } = useToast();
  const { data: players = [] } = usePlayers();
  const [playerFilter, setPlayerFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ Completed: true });

  const { data: tasks = [], isLoading } = useCoachTasks({
    playerId: playerFilter ? Number(playerFilter) : undefined,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    completed: statusFilter === 'all' ? undefined : statusFilter === 'completed',
  });

  const deleteTask = useDeleteTask();
  const [assignOpen, setAssignOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editTask, setEditTask] = useState<PlayerTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlayerTask | null>(null);

  const filtered = categoryFilter ? tasks.filter(t => t.category === categoryFilter) : tasks;
  const groups = groupTasks(filtered);
  const stats = taskStats(tasks);
  const anyFilter = playerFilter || priorityFilter !== 'all' || statusFilter !== 'all' || categoryFilter;

  function clearFilters() {
    setPlayerFilter(''); setPriorityFilter('all'); setStatusFilter('all'); setCategoryFilter('');
  }

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

  const priorityPills: ('all' | TaskPriority)[] = ['all', 'High', 'Medium', 'Low'];
  const statusPills: StatusFilter[] = ['all', 'pending', 'completed'];

  return (
    <PageWrapper
      title="Tasks"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-500/20"
          >
            <Sparkles size={16} /> AI Suggestions
          </button>
          <button
            onClick={() => { setEditTask(null); setAssignOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
          >
            <Plus size={16} /> Assign Task
          </button>
        </div>
      }
    >
      {/* Stats line */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500 dark:text-gray-400">{tasks.length} total</span>
        <span className="text-gray-300 dark:text-gray-700">·</span>
        <span className="font-semibold text-red-500">{stats.overdue} overdue</span>
        <span className="font-semibold text-amber-500">{stats.today} due today</span>
        <span className="font-semibold text-blue-500">{stats.thisWeek} this week</span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select
            value={playerFilter}
            onChange={e => setPlayerFilter(e.target.value)}
            options={[{ value: '', label: 'All Players' }, ...players.map(p => ({ value: String(p.id), label: p.fullName }))]}
          />
        </div>
        {/* Priority pills */}
        <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {priorityPills.map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer',
                priorityFilter === p ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
              {p}
            </button>
          ))}
        </div>
        {/* Status pills */}
        <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {statusPills.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer',
                statusFilter === s ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
              {s}
            </button>
          ))}
        </div>
        <div className="w-40">
          <Select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as TaskCategory | '')}
            options={[{ value: '', label: 'All Categories' }, ...CATEGORY_ORDER.map(c => ({ value: c, label: c }))]}
          />
        </div>
        {anyFilter && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <PageSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title={anyFilter ? 'No tasks match your filters' : 'No tasks yet'}
          description={anyFilter ? 'Try clearing filters.' : 'Assign drills and tasks to your players to track their progress.'}
          action={anyFilter ? undefined : { label: 'Assign Task', onClick: () => { setEditTask(null); setAssignOpen(true); } }}
        />
      ) : (
        <div className="space-y-6">
          {groups.map(({ bucket, tasks: bucketTasks }) => {
            const isCollapsed = collapsed[bucket];
            return (
              <div key={bucket}>
                <button onClick={() => setCollapsed(c => ({ ...c, [bucket]: !c[bucket] }))}
                  className="flex items-center gap-2 mb-3 cursor-pointer group">
                  <ChevronDown size={15} className={clsx('text-gray-400 transition-transform', isCollapsed && '-rotate-90')} />
                  <h3 className={clsx('text-sm font-bold uppercase tracking-wide', BUCKET_ACCENT[bucket])}>{bucket}</h3>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{bucketTasks.length}</span>
                </button>
                {!isCollapsed && (
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
                )}
              </div>
            );
          })}
        </div>
      )}

      <AssignTaskModal
        isOpen={assignOpen}
        onClose={() => { setAssignOpen(false); setEditTask(null); }}
        players={players.map(p => ({ id: p.id, name: p.fullName }))}
        task={editTask}
      />

      <AITaskSuggestionsModal
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        players={players.map(p => ({ id: p.id, name: p.fullName }))}
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
