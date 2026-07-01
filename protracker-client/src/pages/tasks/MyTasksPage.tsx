import { PageWrapper } from '../../components/layout/PageWrapper';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { TaskCard } from '../../components/tasks/TaskCard';
import { useMyTasks, useCompleteTask, useIncompleteTask } from '../../hooks/useTasks';
import { useToast } from '../../context/ToastContext';
import { CheckSquare } from 'lucide-react';

export function MyTasksPage() {
  const { addToast } = useToast();
  const { data: tasks = [], isLoading } = useMyTasks();
  const completeTask = useCompleteTask();
  const incompleteTask = useIncompleteTask();

  const toDo = tasks.filter(t => !t.isCompleted);
  const completed = tasks.filter(t => t.isCompleted);
  const total = tasks.length;
  const doneCount = completed.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  async function handleComplete(id: number, note: string) {
    try {
      await completeTask.mutateAsync({ id, completedNote: note || undefined });
      addToast('Task completed', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  }

  async function handleIncomplete(id: number) {
    try {
      await incompleteTask.mutateAsync(id);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  }

  if (isLoading) return <PageSpinner />;

  return (
    <PageWrapper title="My Tasks">
      {total === 0 ? (
        <EmptyState
          icon={<CheckSquare size={40} />}
          title="No tasks assigned yet"
          description="Your coach will assign tasks here."
        />
      ) : (
        <div className="space-y-6">
          {/* Progress summary */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Progress</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                {doneCount} of {total} completed
              </p>
            </div>
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* To Do */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-500 mb-3">
              To Do <span className="text-gray-400">({toDo.length})</span>
            </h3>
            {toDo.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">All caught up — nothing to do right now.</p>
            ) : (
              <div className="space-y-3">
                {toDo.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={note => handleComplete(task.id, note)}
                    isMutating={completeTask.isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-green-500 mb-3">
                Completed <span className="text-gray-400">({completed.length})</span>
              </h3>
              <div className="space-y-3">
                {completed.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onIncomplete={() => handleIncomplete(task.id)}
                    isMutating={incompleteTask.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
