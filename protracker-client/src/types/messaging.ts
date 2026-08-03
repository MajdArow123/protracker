export interface Message {
  id: number;
  senderId: string;
  receiverId: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  readAt?: string | null;
  isMine: boolean;
}

export interface Conversation {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageMine: boolean;
  unreadCount: number;
}

export interface MessageContact {
  userId: string;
  name: string;
  role: string;
}

export type AnnouncementPriority = 'Normal' | 'Important' | 'Urgent';

export interface TeamAnnouncement {
  id: number;
  teamId: number;
  teamName: string;
  coachId: string;
  coachName: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPinned: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

// ── Notifications (persistent, DB-backed) ────────────────────────────────────
export type NotificationType =
  | 'General' | 'NewMessage' | 'NewTask' | 'TaskOverdue' | 'NewAnnouncement'
  | 'InjuryAlert' | 'SessionReminder' | 'ConnectionRequest' | 'ConnectionAccepted'
  | 'ConnectionDeclined' | 'AthleteJoined' | 'GoalAchieved' | 'AssessmentDue'
  | 'RecoveryMilestone' | 'RecoveryPlanReady' | 'ReviewReceived' | 'LeagueMatchScheduled';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  unreadCount: number;
}
