import type { PlayerTask, TaskPriority, TaskCategory } from '../../types';

export const PRIORITY_BADGE: Record<TaskPriority, string> = {
  High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export const CATEGORY_BADGE: Record<TaskCategory, string> = {
  Training: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Nutrition: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Recovery: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  Tactical: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Physical: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export const PRIORITY_ORDER: TaskPriority[] = ['Low', 'Medium', 'High'];
export const CATEGORY_ORDER: TaskCategory[] = ['Training', 'Nutrition', 'Recovery', 'Tactical', 'Physical', 'Other'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole-day difference (dueDate - today), negative if the due date is in the past. */
export function daysUntilDue(dueDate: string): number {
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function isOverdue(task: PlayerTask): boolean {
  if (task.isCompleted || !task.dueDate) return false;
  return daysUntilDue(task.dueDate) < 0;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export type TaskBucket = 'Overdue' | 'Today' | 'This Week' | 'Later' | 'Completed';
export const BUCKET_ORDER: TaskBucket[] = ['Overdue', 'Today', 'This Week', 'Later', 'Completed'];

export function bucketOf(task: PlayerTask): TaskBucket {
  if (task.isCompleted) return 'Completed';
  if (!task.dueDate) return 'Later';
  const diff = daysUntilDue(task.dueDate);
  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Today';
  if (diff <= 7) return 'This Week';
  return 'Later';
}

/** Groups tasks into ordered non-empty buckets. */
export function groupTasks(tasks: PlayerTask[]): { bucket: TaskBucket; tasks: PlayerTask[] }[] {
  const groups = new Map<TaskBucket, PlayerTask[]>();
  for (const t of tasks) {
    const b = bucketOf(t);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b)!.push(t);
  }
  return BUCKET_ORDER
    .filter(b => groups.has(b))
    .map(b => ({ bucket: b, tasks: groups.get(b)! }));
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
