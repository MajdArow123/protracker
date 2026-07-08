import api from './axiosInstance';
import type {
  PersonalGoal, GoalMilestone, GoalProgress, GoalCategory, GoalStatus, GoalPriority,
  CoachGoalOverview,
} from '../types';

export interface CreateGoalMilestoneInput {
  title: string;
  targetValue?: number | null;
  targetDate?: string | null;
}

export interface CreateGoalInput {
  playerId: number;
  title: string;
  description?: string | null;
  category: GoalCategory;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  linkedStatCategoryId?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  priority: GoalPriority;
  isPrivate: boolean;
  milestones?: CreateGoalMilestoneInput[];
}

export interface UpdateGoalInput {
  title: string;
  description?: string | null;
  category: GoalCategory;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  linkedStatCategoryId?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  status: GoalStatus;
  priority: GoalPriority;
  isPrivate: boolean;
}

export interface LogProgressInput {
  value: number;
  note?: string | null;
  recordedAt?: string | null;
}

export const goalsApi = {
  getMine: () => api.get<PersonalGoal[]>('/api/goals').then(r => r.data),
  getForPlayer: (playerId: number) =>
    api.get<PersonalGoal[]>(`/api/players/${playerId}/goals`).then(r => r.data),
  getCoachOverview: () => api.get<CoachGoalOverview>('/api/goals/overview').then(r => r.data),
  create: (data: CreateGoalInput) => api.post<PersonalGoal>('/api/goals', data).then(r => r.data),
  update: (id: number, data: UpdateGoalInput) => api.put<PersonalGoal>(`/api/goals/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/goals/${id}`),
  achieve: (id: number) => api.patch<PersonalGoal>(`/api/goals/${id}/achieve`, {}).then(r => r.data),
  addMilestone: (id: number, data: CreateGoalMilestoneInput) =>
    api.post<GoalMilestone>(`/api/goals/${id}/milestones`, data).then(r => r.data),
  achieveMilestone: (id: number, mid: number) =>
    api.patch<GoalMilestone>(`/api/goals/${id}/milestones/${mid}/achieve`, {}).then(r => r.data),
  logProgress: (id: number, data: LogProgressInput) =>
    api.post<GoalProgress>(`/api/goals/${id}/progress`, data).then(r => r.data),
  getProgress: (id: number) => api.get<GoalProgress[]>(`/api/goals/${id}/progress`).then(r => r.data),
};
