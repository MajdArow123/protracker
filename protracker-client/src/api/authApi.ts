import api, { tokenStorage } from './axiosInstance';
import type { User, Role } from '../types';

interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

function mapUser(u: ApiUser): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.displayName,
    role: (u.roles[0] ?? 'Athlete') as Role,
  };
}

export const authApi = {
  register: async (displayName: string, email: string, password: string, role: string): Promise<User> => {
    const res = await api.post<{ user: ApiUser; accessToken: string; refreshToken: string }>(
      '/api/auth/register',
      { displayName, email, password, role }
    );
    tokenStorage.setAccess(res.data.accessToken);
    tokenStorage.setRefresh(res.data.refreshToken);
    return mapUser(res.data.user);
  },

  login: async (email: string, password: string): Promise<User> => {
    const res = await api.post<{ user: ApiUser; accessToken: string; refreshToken: string }>(
      '/api/auth/login',
      { email, password }
    );
    tokenStorage.setAccess(res.data.accessToken);
    tokenStorage.setRefresh(res.data.refreshToken);
    return mapUser(res.data.user);
  },

  logout: async (): Promise<void> => {
    const refreshToken = tokenStorage.getRefresh();
    await api.post('/api/auth/logout', { refreshToken }).catch(() => {});
    tokenStorage.clear();
  },

  getMe: async (): Promise<User> => {
    const res = await api.get<ApiUser>('/api/auth/me');
    return mapUser(res.data);
  },

  forgotPassword: async (email: string): Promise<string> => {
    const res = await api.post<{ message: string }>('/api/auth/forgot-password', { email });
    return res.data.message;
  },

  validateResetToken: async (token: string): Promise<{ valid: boolean; email?: string }> => {
    const res = await api.get<{ valid: boolean; email?: string }>(
      `/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`
    );
    return res.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<string> => {
    const res = await api.post<{ message: string }>('/api/auth/reset-password', { token, newPassword });
    return res.data.message;
  },
};
