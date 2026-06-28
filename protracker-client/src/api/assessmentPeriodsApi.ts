import api from './axiosInstance';
import type { AssessmentPeriod } from '../types';

export const assessmentPeriodsApi = {
  getAll: () =>
    api.get<AssessmentPeriod[]>('/api/assessment-periods').then(r => r.data),
  getById: (id: number) =>
    api.get<AssessmentPeriod>(`/api/assessment-periods/${id}`).then(r => r.data),
  create: (data: Omit<AssessmentPeriod, 'id'>) =>
    api.post<AssessmentPeriod>('/api/assessment-periods', data).then(r => r.data),
  update: (id: number, data: Partial<AssessmentPeriod>) =>
    api.put<AssessmentPeriod>(`/api/assessment-periods/${id}`, data).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/api/assessment-periods/${id}`),
};
