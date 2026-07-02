import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCoachTasks, useMyTasks } from './useTasks';
import { useActiveInjuries } from './useInjuries';
import { useMySessions } from './useSessions';
import { isSeen, markSeen, useSeenVersion, overdueTaskKey, myTaskKey, injuryKey, sessionKey } from '../utils/seenNotifications';

export type NotificationKind = 'task' | 'injury' | 'session';
export type NotificationSeverity = 'high' | 'medium' | 'low';

export interface NotificationItem {
  id: string;
  seenKey: string;
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
  // Sidebar badge counts, keyed by nav path (unseen only).
  badges: Record<string, number>;
  // Mark every currently-visible notification as seen (bell open / "mark all as read").
  markAllSeen: () => void;
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
  const seenVersion = useSeenVersion(); // re-run when the seen set changes

  const { data: coachTasks = [] } = useCoachTasks(undefined, isCoach);
  const { data: activeInjuries = [] } = useActiveInjuries(isCoach);
  const { data: myTasks = [] } = useMyTasks(isAthlete);
  const { data: mySessions = [] } = useMySessions(isAthlete);

  return useMemo<NotificationSummary>(() => {
    const raw: NotificationItem[] = [];

    if (isCoach) {
      coachTasks.filter(t => !t.isCompleted && isOverdue(t.dueDate)).forEach(t => raw.push({
        id: `task-${t.id}`,
        seenKey: overdueTaskKey(t.id),
        kind: 'task',
        title: 'Overdue task',
        detail: `${t.playerName}: ${t.title}`,
        severity: 'high',
        to: '/tasks',
        timestamp: t.dueDate ? new Date(t.dueDate).getTime() : 0,
      }));

      activeInjuries.forEach(inj => raw.push({
        id: `injury-${inj.id}`,
        seenKey: injuryKey(inj.id, inj.severity),
        kind: 'injury',
        title: `${inj.severity} injury`,
        detail: `${inj.playerName ?? 'Player'}: ${inj.injuryType}`,
        severity: inj.severity === 'Severe' ? 'high' : inj.severity === 'Moderate' ? 'medium' : 'low',
        to: '/players',
        timestamp: new Date(inj.injuryDate).getTime(),
      }));
    }

    if (isAthlete) {
      myTasks.filter(t => !t.isCompleted).forEach(t => {
        const overdue = isOverdue(t.dueDate);
        raw.push({
          id: `mytask-${t.id}`,
          seenKey: myTaskKey(t.id),
          kind: 'task',
          title: overdue ? 'Task overdue' : 'Task to do',
          detail: t.title,
          severity: overdue ? 'high' : 'medium',
          to: '/player-dashboard/tasks',
          timestamp: t.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER,
        });
      });

      mySessions.filter(s => {
        const t = new Date(s.startTime).getTime();
        return t >= Date.now() - 12 * 60 * 60 * 1000 && t <= Date.now() + 2 * DAY;
      }).forEach(s => raw.push({
        id: `session-${s.id}`,
        seenKey: sessionKey(s.id),
        kind: 'session',
        title: 'Upcoming session',
        detail: `${s.title} · ${new Date(s.startTime).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`,
        severity: 'low',
        to: '/player-dashboard',
        timestamp: new Date(s.startTime).getTime(),
      }));
    }

    // Hide anything already seen/dismissed.
    const items = raw.filter(i => !isSeen(i.seenKey));

    const rank: Record<NotificationSeverity, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => rank[a.severity] - rank[b.severity] || a.timestamp - b.timestamp);

    // Badges count only unseen items, keyed by nav path.
    const badges: Record<string, number> = {};
    for (const i of items) {
      if (i.kind === 'task') badges[i.to] = (badges[i.to] ?? 0) + 1;
    }

    const markAllSeen = () => markSeen(items.map(i => i.seenKey));

    return { items, count: items.length, badges, markAllSeen };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoach, isAthlete, coachTasks, activeInjuries, myTasks, mySessions, seenVersion]);
}
