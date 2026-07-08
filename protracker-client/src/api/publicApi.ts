import api from './axiosInstance';
import type { PublicProfileSettings, PublicProfileView } from '../types';

export interface UpdatePublicProfileInput {
  displayName?: string | null;
  bio?: string | null;
  isPublic: boolean;
  showAssessments: boolean;
  showGoals: boolean;
  showJournal: boolean;
  showMatchHistory: boolean;
}

export const publicApi = {
  getSettings: () => api.get<PublicProfileSettings>('/api/profile/public').then(r => r.data),
  updateSettings: (data: UpdatePublicProfileInput) =>
    api.put<PublicProfileSettings>('/api/profile/public', data).then(r => r.data),
  // Anonymous public view (no auth header needed, but the shared instance sends none anyway).
  getPublic: (slug: string) => api.get<PublicProfileView>(`/api/public/${slug}`).then(r => r.data),
};
