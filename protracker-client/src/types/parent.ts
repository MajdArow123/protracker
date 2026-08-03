// --- Parent portal ---
export interface ParentChild {
  playerId: number;
  fullName: string;
  teamName?: string | null;
  sportName?: string | null;
  positionName?: string | null;
  age?: number | null;
  fitnessLevel?: number | null;
  overallAverage?: number | null;
  activeInjuryCount: number;
}

export interface ChildInjury {
  injuryType: string;
  bodyPart?: string | null;
  severity: string;
  recoveryStatus: string;
  injuryDate: string;
  expectedReturnDate?: string | null;
}

export interface ChildSession {
  title: string;
  sessionType: string;
  startTime: string;
  durationMinutes: number;
  location?: string | null;
}

export interface ChildTask {
  title: string;
  category: string;
  priority: string;
  dueDate?: string | null;
  isCompleted: boolean;
}

export interface ChildWellbeingPoint {
  date: string;
  feeling: number;
  energy: number;
  sleep: number;
  hasPain: boolean;
  score: number;
}

export interface ChildOverview {
  playerId: number;
  fullName: string;
  teamName?: string | null;
  sportName?: string | null;
  positionName?: string | null;
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  fitnessLevel?: number | null;
  averageScoreByCategory: Record<string, number>;
  overallAverage?: number | null;
  lastAssessmentDate?: string | null;
  injuries: ChildInjury[];
  upcomingSessions: ChildSession[];
  tasks: ChildTask[];
  wellbeing: ChildWellbeingPoint[];
  wellbeingScore?: number | null;
}

export interface ParentInviteInfo {
  valid: boolean;
  email: string;
  parentName: string;
  playerName: string;
  coachName: string;
  accountExists: boolean;
}

export interface ParentInviteResult {
  email: string;
  parentName: string;
  inviteUrl: string;
  emailSent: boolean;
}

export interface PlayerParent {
  name: string;
  email: string;
  status: string;
  createdAt: string;
}
