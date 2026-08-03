export interface Team {
  id: number;
  name: string;
  sportId: number;
  sportName: string;
  coachId: string;   // UUID
  playerCount?: number;
  photoUrl?: string | null;
  foundedYear?: number | null;
  description?: string | null;
}

export type CoachRoleType = 'HeadCoach' | 'AssistantCoach' | 'Analyst';

export interface CoachPermissions {
  canAssessPlayers: boolean;
  canAssignTasks: boolean;
  canViewPrivateNotes: boolean;
  canManagePlayers: boolean;
  canManageTeam: boolean;
  // Phase 6: publish/unpublish lineups — gated tighter than lineup editing
  // (canManageTeam). Pre-Phase-6 assistants deserialize to false server-side.
  canPublishLineup: boolean;
}

export interface TeamCoach {
  id?: number | null; // TeamCoachRole id (null for the head coach)
  userId: string;
  name: string;
  email?: string | null;
  profilePictureUrl?: string | null;
  role: CoachRoleType;
  isHeadCoach: boolean;
  isYou: boolean;
  permissions: CoachPermissions;
  acceptedAt?: string | null;
}

export interface InviteCoachInput {
  email: string;
  role: CoachRoleType;
  permissions: CoachPermissions;
}

export interface InviteCoachResult {
  email: string;
  inviteUrl: string;
}

export interface ValidateCoachInvite {
  valid: boolean;
  teamName?: string | null;
  sportName?: string | null;
  inviterName?: string | null;
  email?: string | null;
  role: CoachRoleType;
  emailHasAccount: boolean;
}
