import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { tokenStorage } from '../api/axiosInstance';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (displayName: string, email: string, password: string, role: string) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // If we have a stored access token try getMe immediately; otherwise fall through to null.
    const token = tokenStorage.getAccess();
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .getMe()
      .then(setUser)
      .catch(() => {
        tokenStorage.clear();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const userData = await authApi.login(email, password);
    // Drop any cached queries left over from a previous account on this browser
    // (e.g. a different coach/athlete signing in on a shared machine) before the
    // new session starts fetching its own data.
    queryClient.clear();
    setUser(userData);
    return userData;
  };

  const register = async (displayName: string, email: string, password: string, role: string): Promise<User> => {
    const userData = await authApi.register(displayName, email, password, role);
    queryClient.clear();
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
