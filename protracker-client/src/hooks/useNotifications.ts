import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCoachTasks, useMyTasks } from './useTasks';
import { useActiveInjuries } from './useInjuries';
import { useMySessions } from './useSessions';
import { usePlayers } from './usePlayers';
import { useIncomingRequests, useMyRequests } from './useConnections';
import { isSeen, markSeen, useSeenVersion, overdueTaskKey, myTaskKey, injuryKey, sessionKey, joinedKey, connReqKey, connRespKey } from '../utils/seenNotifications';

export type NotificationKind = 'task' | 'injury' | 'session' | 'join' | 'connection';
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
  const isSolo = user?.role === 'SoloAthlete';
  const seenVersion = useSeenVersion(); // re-run when the seen set changes

  const { data: coachTasks = [] } = useCoachTasks(undefined, isCoach);
  const { data: activeInjuries = [] } = useActiveInjuries(isCoach);
  // Players are already cached for coaches (list/teams pages); used for join alerts.
  const { data: players = [] } = usePlayers(isCoach);
  const { data: myTasks = [] } = useMyTasks(isAthlete || isSolo);
  const { data: mySessions = [] } = useMySessions(isAthlete || isSolo);
  const { data: incomingRequests = [] } = useIncomingRequests('Pending', isCoach);
  const { data: myRequests = [] } = useMyRequests(isAthlete || isSolo);

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

      // Athletes who self-enrolled via a join code in the last 7 days.
      players.filter(p => p.joinedViaCodeAt && Date.now() - new Date(p.joinedViaCodeAt).getTime() < 7 * DAY).forEach(p => raw.push({
        id: `join-${p.id}`,
        seenKey: joinedKey(p.id),
        kind: 'join',
        title: 'New athlete joined',
        detail: `${p.fullName} joined ${p.teamName || 'your team'}`,
        severity: 'medium',
        to: `/players/${p.id}`,
        timestamp: new Date(p.joinedViaCodeAt!).getTime(),
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

      // Pending marketplace connection requests.
      incomingRequests.forEach(r => raw.push({
        id: `connreq-${r.id}`,
        seenKey: connReqKey(r.id),
        kind: 'connection',
        title: 'New connection request',
        detail: `${r.athleteName} wants to connect${r.sportName ? ` · ${r.sportName}` : ''}`,
        severity: 'medium',
        to: '/coach/connection-requests',
        timestamp: new Date(r.requestedAt).getTime(),
      }));
    }

    if (isAthlete || isSolo) {
      myTasks.filter(t => !t.isCompleted).forEach(t => {
        const overdue = isOverdue(t.dueDate);
        raw.push({
          id: `mytask-${t.id}`,
          seenKey: myTaskKey(t.id),
          kind: 'task',
          title: overdue ? 'Task overdue' : 'Task to do',
          detail: t.title,
          severity: overdue ? 'high' : 'medium',
          to: isSolo ? '/solo/tasks' : '/player-dashboard/tasks',
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
        to: isSolo ? '/solo-dashboard' : '/player-dashboard',
        timestamp: new Date(s.startTime).getTime(),
      }));

      // Coach responses to my connection requests (accepted / declined).
      myRequests.filter(r => r.status === 'Accepted' || r.status === 'Declined').forEach(r => raw.push({
        id: `connresp-${r.id}`,
        seenKey: connRespKey(r.id, r.status),
        kind: 'connection',
        title: r.status === 'Accepted' ? 'Connection accepted' : 'Connection update',
        detail: r.status === 'Accepted'
          ? `${r.coachName} accepted your request${r.resultJoinCode ? ` · code ${r.resultJoinCode}` : ''}`
          : `${r.coachName} responded to your request`,
        severity: r.status === 'Accepted' ? 'medium' : 'low',
        to: isSolo ? '/solo/profile' : '/player-dashboard/profile',
        timestamp: r.respondedAt ? new Date(r.respondedAt).getTime() : new Date(r.requestedAt).getTime(),
      }));
    }

    // Hide anything already seen/dismissed.
    const items = raw.filter(i => !isSeen(i.seenKey));

    const rank: Record<NotificationSeverity, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => rank[a.severity] - rank[b.severity] || a.timestamp - b.timestamp);

    // Badges count only unseen items, keyed by nav path.
    const badges: Record<string, number> = {};
    for (const i of items) {
      if (i.kind === 'task' || i.kind === 'connection') badges[i.to] = (badges[i.to] ?? 0) + 1;
    }

    const markAllSeen = () => markSeen(items.map(i => i.seenKey));

    return { items, count: items.length, badges, markAllSeen };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCoach, isAthlete, isSolo, coachTasks, activeInjuries, players, myTasks, mySessions, incomingRequests, myRequests, seenVersion]);
}
