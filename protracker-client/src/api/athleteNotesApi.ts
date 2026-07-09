import api from './axiosInstance';
import type { AthleteNote, UpsertAthleteNoteInput } from '../types';

export const athleteNotesApi = {
  getMine: () => api.get<AthleteNote[]>('/api/athlete-notes').then(r => r.data),
  create: (data: UpsertAthleteNoteInput) => api.post<AthleteNote>('/api/athlete-notes', data).then(r => r.data),
  update: (id: number, data: UpsertAthleteNoteInput) =>
    api.put<AthleteNote>(`/api/athlete-notes/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/athlete-notes/${id}`),
};
