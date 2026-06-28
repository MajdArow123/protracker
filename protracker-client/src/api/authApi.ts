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
};
