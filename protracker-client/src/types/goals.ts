// ─── Personal goals (Phase B) ─────────────────────────────────────────────────
export type GoalCategory = 'Performance' | 'Fitness' | 'Nutrition' | 'Mental' | 'Technical' | 'Tactical' | 'Other';
export type GoalStatus = 'Active' | 'Achieved' | 'Paused' | 'Abandoned';
export type GoalPriority = 'High' | 'Medium' | 'Low';
export type GoalProgressSource = 'Manual' | 'Assessment' | 'Match' | 'Auto';

export interface GoalMilestone {
  id: number;
  personalGoalId: number;
  title: string;
  targetValue?: number | null;
  isAchieved: boolean;
  achievedAt?: string | null;
  targetDate?: string | null;
}

export interface PersonalGoal {
  id: number;
  playerId: number;
  playerName: string;
  title: string;
  description?: string | null;
  category: GoalCategory;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  linkedStatCategoryId?: number | null;
  linkedStatCategoryName?: string | null;
  startDate: string;
  targetDate?: string | null;
  status: GoalStatus;
  priority: GoalPriority;
  isPrivate: boolean;
  createdAt: string;
  updatedAt?: string | null;
  achievedAt?: string | null;
  progressPercent?: number | null;
  milestones: GoalMilestone[];
}

export interface GoalProgress {
  id: number;
  personalGoalId: number;
  value: number;
  note?: string | null;
  recordedAt: string;
  source: GoalProgressSource;
}

export interface GoalSuggestion {
  title: string;
  description?: string | null;
  category: GoalCategory;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  linkedStatCategoryId?: number | null;
  timelineWeeks?: number | null;
  focusArea?: string | null;
}

export interface GoalSuggestions {
  playerId: number;
  playerName: string;
  weakAreas: string[];
  suggestions: GoalSuggestion[];
}

export interface CoachGoalOverviewRow {
  playerId: number;
  playerName: string;
  activeGoals: number;
  achievedGoals: number;
  avgProgress?: number | null;
}

export interface CoachGoalOverview {
  players: CoachGoalOverviewRow[];
  totalActiveGoals: number;
  playersWithGoals: number;
}
