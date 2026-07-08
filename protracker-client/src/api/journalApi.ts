import api from './axiosInstance';
import type { JournalEntry, JournalMood } from '../types';

export interface UpsertJournalInput {
  title?: string | null;
  content: string;
  mood: JournalMood;
  energyLevel: number;
  trainingRating?: number | null;
  keyLearning?: string | null;
  tomorrowFocus?: string | null;
  tags?: string | null;
  isPrivate: boolean;
}

export const journalApi = {
  getMine: (days = 90) => api.get<JournalEntry[]>(`/api/journal?days=${days}`).then(r => r.data),
  getToday: () => api.get<JournalEntry | null>('/api/journal/today').then(r => r.data),
  upsertToday: (data: UpsertJournalInput) => api.post<JournalEntry>('/api/journal', data).then(r => r.data),
  update: (id: number, data: UpsertJournalInput) => api.put<JournalEntry>(`/api/journal/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/api/journal/${id}`),
  getForPlayer: (playerId: number, days = 90) =>
    api.get<JournalEntry[]>(`/api/players/${playerId}/journal?days=${days}`).then(r => r.data),
};
