import type { GoalCategory, GoalStatus, GoalPriority, PersonalGoal } from '../../types';

export const CATEGORY_BADGE: Record<GoalCategory, string> = {
  Performance: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Fitness: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Nutrition: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Mental: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Technical: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  Tactical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export const STATUS_BADGE: Record<GoalStatus, string> = {
  Active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Achieved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Abandoned: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

// Left-border accent by priority (High=red, Medium=amber, Low=blue).
export const PRIORITY_BORDER: Record<GoalPriority, string> = {
  High: 'border-l-red-500',
  Medium: 'border-l-amber-500',
  Low: 'border-l-blue-500',
};

export const PRIORITY_BADGE: Record<GoalPriority, string> = {
  High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

// Progress-bar fill color from completion percent (red → amber → green).
export function progressColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export const CATEGORY_ORDER: GoalCategory[] = ['Performance', 'Fitness', 'Nutrition', 'Mental', 'Technical', 'Tactical', 'Other'];
export const PRIORITY_ORDER: GoalPriority[] = ['High', 'Medium', 'Low'];

export type GoalFilter = 'All' | 'Active' | 'Achieved' | 'Paused';

export function matchesFilter(goal: PersonalGoal, filter: GoalFilter): boolean {
  if (filter === 'All') return true;
  return goal.status === filter;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// A goal's completion 0-100: uses the measured target when present, else milestone count.
export function completionPercent(goal: PersonalGoal): number | null {
  if (goal.status === 'Achieved') return 100;
  if (goal.progressPercent != null) return goal.progressPercent;
  if (goal.milestones.length > 0) {
    const done = goal.milestones.filter(m => m.isAchieved).length;
    return Math.round((done / goal.milestones.length) * 100);
  }
  return null;
}

export function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const today = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
