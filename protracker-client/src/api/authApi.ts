import api from './axiosInstance';
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
  // login returns { user: ApiUser }
  login: async (email: string, password: string): Promise<User> => {
    const res = await api.post<{ user: ApiUser }>('/api/auth/login', { email, password });
    return mapUser(res.data.user);
  },
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },
  // getMe returns ApiUser directly
  getMe: async (): Promise<User> => {
    const res = await api.get<ApiUser>('/api/auth/me');
    return mapUser(res.data);
  },
};
