import type { DrillDifficulty } from './drills';

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskCategory = 'Training' | 'Nutrition' | 'Recovery' | 'Tactical' | 'Physical' | 'Other';

export interface TaskSuggestion {
  title: string;
  description: string;
  priority: TaskPriority;
  category: TaskCategory;
  focusArea?: string | null;
  rationale?: string | null;
}

export interface TaskSuggestions {
  playerId: number;
  playerName: string;
  weakAreas: string[];
  suggestions: TaskSuggestion[];
  generatedAt: string;
}

export interface PlayerTaskStats {
  playerId: number;
  playerName: string;
  total: number;
  completed: number;
  overdue: number;
  completionRate: number;
}

export interface TaskCategoryStats {
  category: TaskCategory;
  total: number;
  completed: number;
  completionRate: number;
}

export interface WeeklyTaskTrend {
  weekStart: string;
  weekLabel: string;
  assigned: number;
  completed: number;
}

export interface TaskAnalytics {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  avgDaysToComplete?: number | null;
  playerStats: PlayerTaskStats[];
  categoryStats: TaskCategoryStats[];
  weeklyTrend: WeeklyTaskTrend[];
  topPerformer?: PlayerTaskStats | null;
  needsAttention?: PlayerTaskStats | null;
}

export interface PlayerTask {
  id: number;
  coachId: string;
  playerId: number;
  playerName: string;
  drillId?: number | null;
  drillDifficulty?: DrillDifficulty | null;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: TaskPriority;
  category: TaskCategory;
  isCompleted: boolean;
  completedAt?: string | null;
  completedNote?: string | null;
  createdAt: string;
}
