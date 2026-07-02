import api from './axiosInstance';
import type { CoachNote, CoachNoteCategory } from '../types';

export interface CreateCoachNoteInput {
  content: string;
  category: CoachNoteCategory;
  isPrivate: boolean;
}

export const coachNotesApi = {
  getForPlayer: (playerId: number) =>
    api.get<CoachNote[]>(`/api/players/${playerId}/notes`).then(r => r.data),
  create: (playerId: number, data: CreateCoachNoteInput) =>
    api.post<CoachNote>(`/api/players/${playerId}/notes`, data).then(r => r.data),
  update: (id: number, data: CreateCoachNoteInput) =>
    api.put<CoachNote>(`/api/notes/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/notes/${id}`),
};
