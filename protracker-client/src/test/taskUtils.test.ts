import { describe, it, expect } from 'vitest';
import { bucketOf, groupTasks, taskStats, getInitials, isOverdue } from '../components/tasks/taskUtils';
import type { PlayerTask } from '../types';

// A date at local noon N days from today — avoids timezone/midnight edge cases in day-diff math.
function dayAt(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

function task(overrides: Partial<PlayerTask>): PlayerTask {
  return {
    id: 1, coachId: 'c', playerId: 1, playerName: 'P', title: 'T',
    priority: 'Medium', category: 'Training', isCompleted: false,
    createdAt: dayAt(-10), ...overrides,
  } as PlayerTask;
}

describe('taskUtils.bucketOf', () => {
  it('completed tasks go to Completed', () => {
    expect(bucketOf(task({ isCompleted: true, dueDate: dayAt(-1) }))).toBe('Completed');
  });
  it('tasks with no due date go to Later', () => {
    expect(bucketOf(task({ dueDate: null }))).toBe('Later');
  });
  it('past due date → Overdue', () => {
    expect(bucketOf(task({ dueDate: dayAt(-1) }))).toBe('Overdue');
  });
  it('due today → Today', () => {
    expect(bucketOf(task({ dueDate: dayAt(0) }))).toBe('Today');
  });
  it('due in 3 days → This Week', () => {
    expect(bucketOf(task({ dueDate: dayAt(3) }))).toBe('This Week');
  });
  it('due in 30 days → Later', () => {
    expect(bucketOf(task({ dueDate: dayAt(30) }))).toBe('Later');
  });
});

describe('taskUtils', () => {
  it('groupTasks returns non-empty buckets in canonical order', () => {
    const groups = groupTasks([
      task({ id: 1, dueDate: dayAt(3) }),   // This Week
      task({ id: 2, dueDate: dayAt(-1) }),  // Overdue
      task({ id: 3, isCompleted: true }),   // Completed
    ]);
    expect(groups.map(g => g.bucket)).toEqual(['Overdue', 'This Week', 'Completed']);
  });

  it('taskStats counts open overdue/today/thisWeek', () => {
    const stats = taskStats([
      task({ id: 1, dueDate: dayAt(-1) }),
      task({ id: 2, dueDate: dayAt(0) }),
      task({ id: 3, dueDate: dayAt(2) }),
      task({ id: 4, dueDate: dayAt(-1), isCompleted: true }), // ignored (completed)
    ]);
    expect(stats).toEqual({ overdue: 1, today: 1, thisWeek: 1 });
  });

  it('getInitials takes the first two initials', () => {
    expect(getInitials('Lucas Ward')).toBe('LW');
    expect(getInitials('madonna')).toBe('M');
  });

  it('isOverdue is false for completed tasks', () => {
    expect(isOverdue(task({ dueDate: dayAt(-5) }))).toBe(true);
    expect(isOverdue(task({ dueDate: dayAt(-5), isCompleted: true }))).toBe(false);
  });
});
