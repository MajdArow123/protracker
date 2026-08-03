export type PlayerStatus = 'Active' | 'Injured' | 'Suspended' | 'Inactive';

export interface Player {
  id: number;
  userId?: string;   // UUID — only on detail endpoint
  fullName: string;
  age?: number;
  height?: number;
  weight?: number;
  sportId: number;
  teamId?: number;
  teamName?: string;
  positionId?: number;
  positionName?: string;
  // Null = not recorded (nullable since the tactical layer — a value is a real coach entry).
  fitnessLevel?: number | null;
  // Coach-entered tactical attributes (Phase 3). Enum name "Left"/"Right"/"Both"; null = not set.
  preferredFoot?: string | null;
  secondaryPositionIds?: number[];
  profileImageUrl?: string | null;
  jerseyNumber?: number | null;
  status?: PlayerStatus;
  // Set only for athletes who self-enrolled via a team join code.
  joinedViaCodeAt?: string | null;
  // detail-only fields
  injuryNotes?: string | null;
  goals?: string | null;
  coachNotes?: string | null;
}
