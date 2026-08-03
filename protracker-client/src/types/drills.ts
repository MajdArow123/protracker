import type { TaskPriority } from './tasks';

// ─── Drill library (Phase C) ──────────────────────────────────────────────────
export type DrillCategory =
  | 'WarmUp' | 'Technical' | 'Tactical' | 'Fitness' | 'Strength'
  | 'Speed' | 'Agility' | 'Recovery' | 'Mental' | 'Cooldown';
export type DrillDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';

export interface DrillUsage {
  timesAssigned: number;
  timesCompleted: number;
  completionRate: number;
  playerCount: number;
}

export interface Drill {
  id: number;
  name: string;
  description?: string | null;
  sportIds: number[];
  sportNames: string[];
  category: DrillCategory;
  difficulty: DrillDifficulty;
  durationMinutes?: number | null;
  equipment?: string | null;
  instructions?: string | null;
  videoUrl?: string | null;
  targetStatCategories: string[];
  isBuiltIn: boolean;
  isCustom: boolean;
  isFavorited: boolean;
  createdAt: string;
  usage?: DrillUsage | null;
  // Populated only by recommendation responses (Section 3).
  recommendReason?: string | null;
  recommendTarget?: string | null;
}

export interface DrillRecommendationItem {
  drill: Drill;
  reasoning: string;
  targetCategory?: string | null;
  priority: TaskPriority;
}

export interface DrillRecommendations {
  playerId: number;
  playerName: string;
  weakAreas: string[];
  recommendations: DrillRecommendationItem[];
}

export interface DrillRank {
  drillId: number;
  name: string;
  assigned: number;
  completed: number;
  completionRate: number;
}

export interface DrillCategoryStat {
  category: DrillCategory;
  total: number;
  completed: number;
  completionRate: number;
}

export interface DrillPlayerStat {
  playerId: number;
  playerName: string;
  drillCount: number;
}

export interface DrillAnalytics {
  drillBasedTasks: number;
  manualTasks: number;
  totalDrillsAssigned: number;
  overallCompletionRate: number;
  mostAssigned: DrillRank[];
  mostCompleted: DrillRank[];
  byCategory: DrillCategoryStat[];
  byPlayer: DrillPlayerStat[];
}
