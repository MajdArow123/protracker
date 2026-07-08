import api from './axiosInstance';
import type { PlayerAssessment } from '../types';

export interface BulkAssessmentInput {
  assessmentPeriodId: number;
  dateRecorded: string;
  assessments: {
    playerId: number;
    notes?: string | null;
    statScores: { sportStatCategoryId: number; score: number }[];
  }[];
}

export const assessmentsApi = {
  getPlayerAssessments: (playerId: number) =>
    api.get<PlayerAssessment[]>(`/api/player-assessments/player/${playerId}`).then(r => r.data),
  bulkCreate: (data: BulkAssessmentInput) =>
    api.post<PlayerAssessment[]>('/api/player-assessments/bulk', data).then(r => r.data),
  getAssessment: (id: number) =>
    api.get<PlayerAssessment>(`/api/player-assessments/${id}`).then(r => r.data),
  createAssessment: (data: Omit<PlayerAssessment, 'id' | 'assessmentPeriodName' | 'statScores'> & {
    statScores: { sportStatCategoryId: number; score: number; playerAssessmentId: number }[];
  }) =>
    api.post<PlayerAssessment>('/api/player-assessments', data).then(r => r.data),
  updateAssessment: (id: number, data: Partial<PlayerAssessment>) =>
    api.put<PlayerAssessment>(`/api/player-assessments/${id}`, data).then(r => r.data),
  deleteAssessment: (id: number) =>
    api.delete(`/api/player-assessments/${id}`),
};
