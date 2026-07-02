import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCoachTasks, useMyTasks } from './useTasks';
import { useActiveInjuries } from './useInjuries';
import { useMySessions } from './useSessions';

export type NotificationKind = 'task' | 'injury' | 'session';
export type NotificationSeverity = 'high' | 'medium' | 'low';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  severity: NotificationSeverity;
  to: string;
  timestamp: number; // for sorting (soonest / most urgent first)
}

export interface NotificationSummary {
  items: NotificationItem[];
  count: number;
  // Sidebar badge counts, keyed by nav path.
  badges: Record<string, number>;
}

const DAY = 24 * 60 * 60 * 1000;

function isOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function useNotifications(): NotificationSummary {
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const isAthlete = user?.role === 'Athlete';

  const { data: coachTasks = [] } = useCoachTasks(undefined, isCoach);
  const { data: activeInjuries = [] } = useActiveInjuries(isCoach);
  const { data: myTasks = [] } = useMyTasks(isAthlete);
  const { data: mySessions = [] } = useMySessions(isAthlete);

  return useMemo<NotificationSummary>(() => {
    const items: NotificationItem[] = [];
    const badges: Record<string, number> = {};

    if (isCoach) {
      // Overdue, still-open tasks the coach assigned.
      const overdue = coachTasks.filter(t => !t.isCompleted && isOverdue(t.dueDate));
      overdue.forEach(t => items.push({
        id: `task-${t.id}`,
        kind: 'task',
        title: 'Overdue task',
        detail: `${t.playerName}: ${t.title}`,
        severity: 'high',
        to: '/tasks',
        timestamp: t.dueDate ? new Date(t.dueDate).getTime() : 0,
      }));
      if (overdue.length) badges['/tasks'] = overdue.length;

      // Active (unrecovered) injuries across the coach's teams.
      activeInjuries.forEach(inj => items.push({
        id: `injury-${inj.id}`,
        kind: 'injury',
        title: `${inj.severity} injury`,
        detail: `${inj.playerName ?? 'Player'}: ${inj.injuryType}`,
        severity: inj.severity === 'Severe' ? 'high' : inj.severity === 'Moderate' ? 'medium' : 'low',
        to: '/players',
        timestamp: new Date(inj.injuryDate).getTime(),
      }));
    }

    if (isAthlete) {
      // The athlete's own open tasks (overdue first, then simply pending).
      const openTasks = myTasks.filter(t => !t.isCompleted);
      openTasks.forEach(t => {
        const overdue = isOverdue(t.dueDate);
        items.push({
          id: `mytask-${t.id}`,
          kind: 'task',
          title: overdue ? 'Task overdue' : 'Task to do',
          detail: t.title,
          severity: overdue ? 'high' : 'medium',
          to: '/player-dashboard/tasks',
          timestamp: t.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER,
        });
      });
      if (openTasks.length) badges['/player-dashboard/tasks'] = openTasks.length;

      // Sessions happening within the next 48 hours.
      const soon = mySessions.filter(s => {
        const t = new Date(s.startTime).getTime();
        return t >= Date.now() - 12 * 60 * 60 * 1000 && t <= Date.now() + 2 * DAY;
      });
      soon.forEach(s => items.push({
        id: `session-${s.id}`,
        kind: 'session',
        title: 'Upcoming session',
        detail: `${s.title} · ${new Date(s.startTime).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`,
        severity: 'low',
        to: '/player-dashboard',
        timestamp: new Date(s.startTime).getTime(),
      }));
    }

    // High severity first; within a severity, soonest/most-overdue first.
    const rank: Record<NotificationSeverity, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => rank[a.severity] - rank[b.severity] || a.timestamp - b.timestamp);

    return { items, count: items.length, badges };
  }, [isCoach, isAthlete, coachTasks, activeInjuries, myTasks, mySessions]);
}
