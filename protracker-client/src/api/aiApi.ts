import api from './axiosInstance';
import type { ImprovementPlan, NutritionGuidance, TaskSuggestions, GoalSuggestions, DrillRecommendations } from '../types';

export interface AIInsights {
  insights: string[];
  generatedAt: string;
}

export const aiApi = {
  generateImprovementPlan: async (playerId: number): Promise<ImprovementPlan> => {
    const res = await api.post<ImprovementPlan>(`/api/ai/improvement-plan/${playerId}`);
    return res.data;
  },

  generateNutritionGuidance: async (playerId: number): Promise<NutritionGuidance> => {
    const res = await api.post<NutritionGuidance>(`/api/ai/nutrition-guidance/${playerId}`);
    return res.data;
  },

  generatePerformanceInsights: async (playerId: number): Promise<AIInsights> => {
    const res = await api.post<AIInsights>(`/api/ai/performance-insights/${playerId}`);
    return res.data;
  },

  generateTeamInsights: async (teamId: number): Promise<AIInsights> => {
    const res = await api.post<AIInsights>(`/api/ai/team-insights/${teamId}`);
    return res.data;
  },

  generateTaskSuggestions: async (playerId: number): Promise<TaskSuggestions> => {
    const res = await api.post<TaskSuggestions>(`/api/ai/task-suggestions/${playerId}`);
    return res.data;
  },

  generateGoalSuggestions: async (playerId: number): Promise<GoalSuggestions> => {
    const res = await api.post<GoalSuggestions>(`/api/ai/goal-suggestions/${playerId}`);
    return res.data;
  },

  generateDrillRecommendations: async (playerId: number): Promise<DrillRecommendations> => {
    const res = await api.post<DrillRecommendations>(`/api/ai/drill-recommendations/${playerId}`);
    return res.data;
  },
};
