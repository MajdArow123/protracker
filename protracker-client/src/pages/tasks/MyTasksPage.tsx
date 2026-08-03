import { useState } from 'react';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { TaskCard } from '../../components/tasks/TaskCard';
import { bucketOf } from '../../components/tasks/taskUtils';
import { useMyTasks, useCompleteTask, useIncompleteTask } from '../../hooks/useTasks';
import { useToast } from '../../context/useToast';
import { CheckCircle, CheckSquare, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import type { PlayerTask } from '../../types';
import { useTranslation } from 'react-i18next';

function ProgressRing({ pct }: { pct: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-gray-100 dark:stroke-gray-800" />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          className="stroke-green-500 transition-all duration-700" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-black text-gray-900 dark:text-white">{pct}%</span>
      </div>
    </div>
  );
}

export function MyTasksPage() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { data: tasks = [], isLoading } = useMyTasks();
  const completeTask = useCompleteTask();
  const incompleteTask = useIncompleteTask();
  const [showCompleted, setShowCompleted] = useState(false);

  const total = tasks.length;
  const completed = tasks.filter(t => t.isCompleted);
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // Action Required = overdue + due today; Upcoming = the rest of the open tasks.
  const open = tasks.filter(t => !t.isCompleted);
  const actionRequired = open.filter(t => ['Overdue', 'Today'].includes(bucketOf(t)));
  const upcoming = open.filter(t => !['Overdue', 'Today'].includes(bucketOf(t)));

  async function handleComplete(id: number, note: string) {
    try { await completeTask.mutateAsync({ id, completedNote: note || undefined }); addToast(t('tasks.taskCompleted', 'Task completed'), 'success'); }
    catch (err) { addToast(err instanceof Error ? err.message : t('tasks.failedToUpdate', 'Failed to update'), 'error'); }
  }
  async function handleIncomplete(id: number) {
    try { await incompleteTask.mutateAsync(id); }
    catch (err) { addToast(err instanceof Error ? err.message : t('tasks.failedToUpdate', 'Failed to update'), 'error'); }
  }

  if (isLoading) return <PageSpinner />;

  const section = (label: string, accent: string, list: PlayerTask[]) => list.length > 0 && (
    <div>
      <h3 className={clsx('text-sm font-bold uppercase tracking-wide mb-3', accent)}>
        {label} <span className="text-gray-400">({list.length})</span>
      </h3>
      <div className="space-y-3">
        {list.map(task => (
          <TaskCard key={task.id} task={task} onComplete={note => handleComplete(task.id, note)} isMutating={completeTask.isPending} />
        ))}
      </div>
    </div>
  );

  return (
    <PageWrapper title={t('tasks.myTasks', 'My Tasks')}>
      {total === 0 ? (
        <div className="py-12 flex flex-col items-center text-center">
          <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-3"><CheckSquare size={36} className="text-gray-400" /></div>
          <p className="text-base font-bold text-gray-900 dark:text-white">{t('tasks.noAssignedYet', 'No tasks assigned yet')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('tasks.coachWillAssign', 'Your coach will assign tasks here.')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progress header */}
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <ProgressRing pct={pct} />
            <div>
              <p className="text-base font-black text-gray-900 dark:text-white">{t('tasks.doneOf', '{{completed}} of {{total}} done', { completed: completed.length, total })}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {open.length === 0 ? t('tasks.allCaughtUp', "You're all caught up!") : t('tasks.needAttentionUpcoming', '{{attention}} need attention · {{upcoming}} upcoming', { attention: actionRequired.length, upcoming: upcoming.length })}
              </p>
            </div>
          </div>

          {open.length === 0 ? (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="p-4 rounded-full bg-green-500/10 mb-3"><CheckCircle size={36} className="text-green-500" /></div>
              <p className="text-base font-bold text-gray-900 dark:text-white">{t('tasks.allCaughtUp', "You're all caught up!")}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('tasks.noPendingNow', 'No pending tasks right now.')}</p>
            </div>
          ) : (
            <>
              {section(t('tasks.actionRequired', 'Action Required'), 'text-red-500', actionRequired)}
              {section(t('tasks.upcoming', 'Upcoming'), 'text-blue-500', upcoming)}
            </>
          )}

          {/* Completed (collapsed by default) */}
          {completed.length > 0 && (
            <div>
              <button onClick={() => setShowCompleted(s => !s)} className="flex items-center gap-2 mb-3 cursor-pointer">
                <ChevronDown size={15} className={clsx('text-gray-400 transition-transform', !showCompleted && '-rotate-90')} />
                <h3 className="text-sm font-bold uppercase tracking-wide text-green-500">{t('tasks.completed', 'Completed')} <span className="text-gray-400">({completed.length})</span></h3>
              </button>
              {showCompleted && (
                <div className="space-y-3">
                  {completed.map(task => (
                    <TaskCard key={task.id} task={task} onIncomplete={() => handleIncomplete(task.id)} isMutating={incompleteTask.isPending} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
