import { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { TaskCard } from '../../components/tasks/TaskCard';
import { AssignTaskModal } from '../../components/tasks/AssignTaskModal';
import { AITaskSuggestionsModal } from '../../components/tasks/AITaskSuggestionsModal';
import { groupTasks, taskStats, CATEGORY_ORDER } from '../../components/tasks/taskUtils';
import { useCoachTasks, useDeleteTask } from '../../hooks/useTasks';
import { useMyPlayerId } from '../../hooks/useDashboard';
import { usePlayers } from '../../hooks/usePlayers';
import { ExportMenu, type ExportOption } from '../../components/ui/ExportMenu';
import { exportCsv, todayStamp, csvDate, type CsvRow } from '../../utils/csv';
import { useToast } from '../../context/useToast';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, ChevronDown, X, Sparkles, BarChart3, Library } from 'lucide-react';
import { DrillLibraryModal } from '../../components/drills/DrillLibraryModal';
import type { PlayerTask, TaskPriority, TaskCategory } from '../../types';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useDynamicLabels } from '../../i18n/dynamicLabels';

const BUCKET_ACCENT: Record<string, string> = {
  Overdue: 'text-red-500',
  Today: 'text-amber-500',
  'This Week': 'text-blue-500',
  Later: 'text-gray-500',
  Completed: 'text-green-500',
};

type StatusFilter = 'all' | 'pending' | 'completed';

// `self` = solo-athlete mode: same page, but every task is your own — the player
// picker disappears, both modals lock to your player, and the wording turns personal.
export function TasksPage({ self = false }: { self?: boolean }) {
  const { t: tr } = useTranslation();
  const L = useDynamicLabels();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const BUCKET_LABEL: Record<string, string> = {
    Overdue: tr('tasks.bucket.overdue', 'Overdue'),
    Today: tr('tasks.bucket.today', 'Today'),
    'This Week': tr('tasks.bucket.thisWeek', 'This Week'),
    Later: tr('tasks.bucket.later', 'Later'),
    Completed: tr('tasks.completed', 'Completed'),
  };
  const { data: players = [] } = usePlayers();
  const { data: myPlayerId } = useMyPlayerId();
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
  const [libraryOpen, setLibraryOpen] = useState(false);
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
      addToast(tr('tasks.taskDeleted', 'Task deleted'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : tr('tasks.deleteFailed', 'Delete failed'), 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  const priorityPills: ('all' | TaskPriority)[] = ['all', 'High', 'Medium', 'Low'];
  const statusPills: StatusFilter[] = ['all', 'pending', 'completed'];

  const exportOptions: ExportOption[] = [
    {
      label: tr('tasks.exportTasks', 'Tasks'),
      description: tr('tasks.exportTasksDesc', 'Current list as CSV'),
      run: () => {
        if (tasks.length === 0) throw new Error('No tasks to export.');
        const rows: CsvRow[] = tasks.map(t => ({
          Player: t.playerName,
          Title: t.title,
          Category: t.category,
          Priority: t.priority,
          'Due Date': csvDate(t.dueDate),
          Status: t.isCompleted ? 'Completed' : 'Open',
          'Completed Date': csvDate(t.completedAt),
        }));
        exportCsv(`Tasks-${todayStamp()}.csv`, rows);
      },
    },
  ];

  return (
    <PageWrapper
      title={self ? tr('tasks.myTasks', 'My Tasks') : tr('tasks.title', 'Tasks')}
      actions={
        <div className="flex gap-2">
          <ExportMenu options={exportOptions} onError={msg => addToast(msg, 'error')} />
          {!self && (
          <button
            onClick={() => navigate('/tasks/analytics')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold transition-all cursor-pointer"
          >
            <BarChart3 size={16} /> {tr('nav.analytics', 'Analytics')}
          </button>
          )}
          <button
            onClick={() => setLibraryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-semibold transition-all cursor-pointer"
          >
            <Library size={16} /> {tr('tasks.browseLibrary', 'Browse Library')}
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-500/20"
          >
            <Sparkles size={16} /> {tr('tasks.aiSuggestions', 'AI Suggestions')}
          </button>
          <button
            onClick={() => { setEditTask(null); setAssignOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
          >
            <Plus size={16} /> {self ? tr('tasks.newTask', 'New Task') : tr('tasks.assignTask', 'Assign Task')}
          </button>
        </div>
      }
    >
      {/* Stats line */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500 dark:text-gray-400">{tr('tasks.totalCount', '{{count}} total', { count: tasks.length })}</span>
        <span className="text-gray-300 dark:text-gray-700">·</span>
        <span className="font-semibold text-red-500">{tr('tasks.overdueCount', '{{count}} overdue', { count: stats.overdue })}</span>
        <span className="font-semibold text-amber-500">{tr('tasks.dueTodayCount', '{{count}} due today', { count: stats.today })}</span>
        <span className="font-semibold text-blue-500">{tr('tasks.thisWeekCount', '{{count}} this week', { count: stats.thisWeek })}</span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {!self && (
        <div className="w-44">
          <Select
            value={playerFilter}
            onChange={e => setPlayerFilter(e.target.value)}
            options={[{ value: '', label: tr('tasks.allPlayers', 'All Players') }, ...players.map(p => ({ value: String(p.id), label: p.fullName }))]}
          />
        </div>
        )}
        {/* Priority pills */}
        <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {priorityPills.map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer',
                priorityFilter === p ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
              {p === 'all' ? tr('common.all', 'All') : L.priority(p)}
            </button>
          ))}
        </div>
        {/* Status pills */}
        <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {statusPills.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer',
                statusFilter === s ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400')}>
              {s === 'all' ? tr('common.all', 'All') : s === 'pending' ? tr('tasks.pending', 'Pending') : tr('tasks.completed', 'Completed')}
            </button>
          ))}
        </div>
        <div className="w-40">
          <Select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as TaskCategory | '')}
            options={[{ value: '', label: tr('tasks.allCategories', 'All Categories') }, ...CATEGORY_ORDER.map(c => ({ value: c, label: L.category(c) }))]}
          />
        </div>
        {anyFilter && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">
            <X size={13} /> {tr('tasks.clearFilters', 'Clear filters')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title={anyFilter ? tr('tasks.noMatch', 'No tasks match your filters') : tr('tasks.noTasks', 'No tasks yet')}
          description={anyFilter ? tr('tasks.tryClearingFilters', 'Try clearing filters.') : self ? tr('tasks.emptySelfDesc', 'Set yourself drills and to-dos — small daily wins add up.') : tr('tasks.emptyCoachDesc', 'Assign drills and tasks to your players to track their progress.')}
          action={anyFilter ? undefined : { label: self ? tr('tasks.newTask', 'New Task') : tr('tasks.assignTask', 'Assign Task'), onClick: () => { setEditTask(null); setAssignOpen(true); } }}
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
                  <h3 className={clsx('text-sm font-bold uppercase tracking-wide', BUCKET_ACCENT[bucket])}>{BUCKET_LABEL[bucket] ?? bucket}</h3>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">{bucketTasks.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {bucketTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showPlayer={!self}
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
        lockedPlayerId={self ? myPlayerId : undefined}
      />

      <AITaskSuggestionsModal
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        players={players.map(p => ({ id: p.id, name: p.fullName }))}
        lockedPlayerId={self ? myPlayerId : undefined}
      />

      <DrillLibraryModal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        players={players.map(p => ({ id: p.id, name: p.fullName }))}
        lockedPlayerId={self ? myPlayerId : undefined}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={tr('tasks.deleteTask', 'Delete Task')}
        message={tr('tasks.deleteConfirm', 'Delete "{{title}}"? This cannot be undone.', { title: deleteTarget?.title })}
        confirmLabel={tr('common.delete', 'Delete')}
        isLoading={deleteTask.isPending}
      />
    </PageWrapper>
  );
}
