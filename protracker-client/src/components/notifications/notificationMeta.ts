import {
  Bell, MessageSquare, CheckSquare, AlertTriangle, CalendarDays, Handshake,
  UserPlus, Target, Megaphone, Star, Trophy, HeartPulse, ClipboardCheck,
} from 'lucide-react';
import type { NotificationType } from '../../types';

export type NotificationFilter = 'all' | 'unread' | 'messages' | 'tasks' | 'injuries' | 'system';

interface Meta {
  Icon: typeof Bell;
  // Tailwind text + subtle bg for the icon chip.
  color: string;
  category: Exclude<NotificationFilter, 'all' | 'unread'>;
}

const META: Record<NotificationType, Meta> = {
  NewMessage: { Icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10', category: 'messages' },
  NewTask: { Icon: CheckSquare, color: 'text-indigo-500 bg-indigo-500/10', category: 'tasks' },
  TaskOverdue: { Icon: AlertTriangle, color: 'text-red-500 bg-red-500/10', category: 'tasks' },
  NewAnnouncement: { Icon: Megaphone, color: 'text-violet-500 bg-violet-500/10', category: 'system' },
  InjuryAlert: { Icon: AlertTriangle, color: 'text-red-500 bg-red-500/10', category: 'injuries' },
  SessionReminder: { Icon: CalendarDays, color: 'text-teal-500 bg-teal-500/10', category: 'system' },
  ConnectionRequest: { Icon: Handshake, color: 'text-amber-500 bg-amber-500/10', category: 'system' },
  ConnectionAccepted: { Icon: Handshake, color: 'text-green-500 bg-green-500/10', category: 'system' },
  ConnectionDeclined: { Icon: Handshake, color: 'text-gray-500 bg-gray-500/10', category: 'system' },
  AthleteJoined: { Icon: UserPlus, color: 'text-emerald-500 bg-emerald-500/10', category: 'system' },
  GoalAchieved: { Icon: Target, color: 'text-green-500 bg-green-500/10', category: 'system' },
  AssessmentDue: { Icon: ClipboardCheck, color: 'text-amber-500 bg-amber-500/10', category: 'system' },
  RecoveryMilestone: { Icon: HeartPulse, color: 'text-rose-500 bg-rose-500/10', category: 'injuries' },
  RecoveryPlanReady: { Icon: HeartPulse, color: 'text-rose-500 bg-rose-500/10', category: 'injuries' },
  ReviewReceived: { Icon: Star, color: 'text-yellow-500 bg-yellow-500/10', category: 'system' },
  LeagueMatchScheduled: { Icon: Trophy, color: 'text-indigo-500 bg-indigo-500/10', category: 'system' },
  General: { Icon: Bell, color: 'text-gray-500 bg-gray-500/10', category: 'system' },
};

export function notificationMeta(type: NotificationType): Meta {
  return META[type] ?? META.General;
}
