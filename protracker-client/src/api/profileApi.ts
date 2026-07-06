import api from './axiosInstance';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  phoneNumber?: string | null;
  bio?: string | null;
  profilePictureUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  // coach-only
  coachingExperience?: string | null;
  certifications?: string | null;
  specialization?: string | null;
  hasCompletedOnboarding: boolean;
  // athlete-only
  playerId?: number | null;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
  jerseyNumber?: number | null;
  teamId?: number | null;
  teamName?: string | null;
  positionName?: string | null;
  sportName?: string | null;
  fitnessLevel?: number | null;
}

export interface ProfileUpdatePayload {
  displayName: string;
  phoneNumber?: string | null;
  bio?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  coachingExperience?: string | null;
  certifications?: string | null;
  specialization?: string | null;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
  jerseyNumber?: number | null;
}

export const profileApi = {
  get: async (): Promise<Profile> => {
    const res = await api.get<Profile>('/api/profile');
    return res.data;
  },

  update: async (payload: ProfileUpdatePayload): Promise<Profile> => {
    const res = await api.put<Profile>('/api/profile', payload);
    return res.data;
  },

  uploadPicture: async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post<{ profilePictureUrl: string | null }>('/api/profile/picture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.profilePictureUrl;
  },

  removePicture: async (): Promise<void> => {
    await api.delete('/api/profile/picture');
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/api/profile/change-password', { currentPassword, newPassword });
  },

  deleteAccount: async (password: string): Promise<void> => {
    await api.delete('/api/profile', { data: { password } });
  },

  uploadTeamPhoto: async (teamId: number, file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post<{ photoUrl: string }>(`/api/teams/${teamId}/photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.photoUrl;
  },

  removeTeamPhoto: async (teamId: number): Promise<void> => {
    await api.delete(`/api/teams/${teamId}/photo`);
  },
};
