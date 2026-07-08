import api from './axiosInstance';
import type { AssessmentTemplate, AppliedTemplate } from '../types';

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  sportId: number;
  defaultNotes?: string | null;
  scores: {
    sportStatCategoryId: number;
    defaultScore?: number | null;
    weight?: number | null;
    isRequired: boolean;
  }[];
}

export const assessmentTemplatesApi = {
  list: (sportId?: number) =>
    api.get<AssessmentTemplate[]>(`/api/assessment-templates${sportId ? `?sport=${sportId}` : ''}`).then(r => r.data),
  create: (data: CreateTemplateInput) => api.post<AssessmentTemplate>('/api/assessment-templates', data).then(r => r.data),
  update: (id: number, data: CreateTemplateInput) => api.put<AssessmentTemplate>(`/api/assessment-templates/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/assessment-templates/${id}`),
  apply: (id: number, playerId: number) =>
    api.post<AppliedTemplate>(`/api/assessment-templates/${id}/apply/${playerId}`, {}).then(r => r.data),
};
