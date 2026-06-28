export type Role = 'Coach' | 'Athlete';

export interface User {
  id: string;       // UUID from auth
  email: string;
  fullName: string; // mapped from API's displayName
  role: Role;       // mapped from API's roles[0]
}

export interface Sport {
  id: number;
  name: string;
  description: string;
  iconOrImage?: string | null;
}

export interface Position {
  id: number;
  name: string;
  sportId: number;
}

export interface StatCategory {
  id: number;
  name: string;
  description: string;
  sportId: number;
  minValue: number;
  maxValue: number;
}

export interface Team {
  id: number;
  name: string;
  sportId: number;
  sportName: string;
  coachId: string;   // UUID
  playerCount?: number;
}

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
  fitnessLevel?: number;
  profileImageUrl?: string | null;
  // detail-only fields
  injuryNotes?: string | null;
  goals?: string | null;
  coachNotes?: string | null;
}

export interface PlayerStatScore {
  id: number;
  playerAssessmentId: number;
  sportStatCategoryId: number;
  statCategoryName: string;
  score: number;
}

export interface PlayerAssessment {
  id: number;
  playerId: number;
  assessmentPeriodId: number;
  assessmentPeriodName: string;
  dateRecorded: string;
  notes?: string | null;
  statScores: PlayerStatScore[];
}

export interface NutritionProfileItem {
  id: number;
  playerId: number;
  preferenceType: string;
  category: string;
  specificItem?: string | null;
  severity: string;
  notes?: string | null;
}

export interface NutritionGuidance {
  id: number;
  playerId: number;
  createdDate: string;
  goal?: string | null;
  mealSuggestions?: string | null;
  hydrationTips?: string | null;
  recoveryTips?: string | null;
  foodsToPrioritize?: string | null;
  foodsToLimit?: string | null;
  disclaimer: string;
  isAIGenerated: boolean;
}

export interface ImprovementPlan {
  id: number;
  playerId: number;
  createdDate: string;
  weeklyGoals?: string | null;
  trainingRecommendations?: string | null;
  skillTargets?: string | null;
  sportSpecificDrills?: string | null;
  positionFocus?: string | null;
  coachNotes?: string | null;
  isAIGenerated: boolean;
}

export interface AssessmentPeriod {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  teamId: number;
}

export type InjurySeverity = 'Minor' | 'Moderate' | 'Severe';
export type RecoveryStatus = 'Active' | 'Recovering' | 'FullyRecovered';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface InjuryRecord {
  id: number;
  playerId: number;
  injuryDate: string;
  injuryType: string;
  severity: InjurySeverity;
  recoveryStatus: RecoveryStatus;
  notes?: string | null;
  expectedReturnDate?: string | null;
}

export interface MatchPerformance {
  id: number;
  playerId: number;
  matchDate: string;
  opponent: string;
  performanceRating: number;
  notes?: string | null;
  sportSpecificStats?: string | null;
}

export interface TrainingSession {
  id: number;
  playerId: number;
  teamId: number;
  date: string;
  durationMinutes: number;
  notes?: string | null;
  attendanceStatus: AttendanceStatus;
}

export interface FoodAlternative {
  id: number;
  originalFood: string;
  alternativeFood: string;
  proteinMatchScore: number;
  carbMatchScore: number;
  fatMatchScore: number;
  calorieMatchScore: number;
  recoveryValue: number;
  sportPerformanceNote?: string | null;
  reasonExplanation?: string | null;
}

export interface PlayerAverageScore {
  playerId: number;
  playerName: string;
  averageScore: number;
}

export interface PlayerReport {
  player: Player & { sportName?: string; positionName?: string; teamName?: string };
  assessments: PlayerAssessment[];
  averageScoreByCategory: Record<string, number>;
  injuries: InjuryRecord[];
  recentMatches: MatchPerformance[];
}

export interface TeamReport {
  team: Team;
  playerCount: number;
  averageScoreByCategory: Record<string, number>;
  players: Player[];
  playerAverageScores: PlayerAverageScore[];
  activeInjuryCount: number;
  activeInjuries: InjuryRecord[];
}

export interface CoachDashboard {
  totalTeams: number;
  totalPlayers: number;
  teams: Team[];
}

export interface PlayerDashboard {
  player: Player;
  totalAssessments: number;
  latestAverageScore?: number | null;
  recentAssessments: PlayerAssessment[];
}
