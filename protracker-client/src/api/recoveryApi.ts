import api from './axiosInstance';
import type { RecoveryPlan, RecoveryExerciseCategory, RecoveryTemplate } from '../types';

export interface ExerciseInput {
  title: string;
  description?: string;
  sets?: number | null;
  reps?: number | null;
  durationMinutes?: number | null;
  restSeconds?: number | null;
  week: number;
  dayOfWeek: string;
  category: RecoveryExerciseCategory;
}

export const recoveryApi = {
  getForInjury: (injuryId: number) =>
    api.get<RecoveryPlan | null>(`/api/injuries/${injuryId}/recovery-plan`).then(r => r.data),
  getForPlayer: (playerId: number) =>
    api.get<RecoveryPlan | null>(`/api/players/${playerId}/recovery-plan`).then(r => r.data),
  create: (injuryId: number, data: { title: string; estimatedWeeks: number; notes?: string }) =>
    api.post<RecoveryPlan>(`/api/injuries/${injuryId}/recovery-plan`, data).then(r => r.data),
  generate: (injuryId: number) =>
    api.post<RecoveryPlan>(`/api/ai/recovery-plan/${injuryId}`).then(r => r.data),
  getTemplates: () =>
    api.get<RecoveryTemplate[]>('/api/recovery-templates').then(r => r.data),
  applyTemplate: (injuryId: number, templateId: number) =>
    api.post<RecoveryPlan>(`/api/injuries/${injuryId}/recovery-plan/from-template/${templateId}`).then(r => r.data),
  updatePlan: (planId: number, data: { title: string; estimatedWeeks: number; currentWeek: number; status: string; notes?: string }) =>
    api.put<RecoveryPlan>(`/api/recovery-plans/${planId}`, data).then(r => r.data),
  addExercise: (planId: number, data: ExerciseInput) =>
    api.post<RecoveryPlan>(`/api/recovery-plans/${planId}/exercises`, data).then(r => r.data),
  updateExercise: (exerciseId: number, data: ExerciseInput) =>
    api.put<RecoveryPlan>(`/api/recovery-exercises/${exerciseId}`, data).then(r => r.data),
  deleteExercise: (exerciseId: number) =>
    api.delete<RecoveryPlan>(`/api/recovery-exercises/${exerciseId}`).then(r => r.data),
  completeExercise: (exerciseId: number, data: { completedNote?: string; difficultyRating?: number }) =>
    api.patch<RecoveryPlan>(`/api/recovery-exercises/${exerciseId}/complete`, data).then(r => r.data),
  addMilestone: (planId: number, data: { title: string; targetWeek: number }) =>
    api.post<RecoveryPlan>(`/api/recovery-plans/${planId}/milestones`, data).then(r => r.data),
  achieveMilestone: (milestoneId: number) =>
    api.patch<RecoveryPlan>(`/api/recovery-milestones/${milestoneId}/achieve`, {}).then(r => r.data),
};
