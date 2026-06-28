import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as authApiModule from '../api/authApi';
import type { User } from '../types';

const mockUser: User = {
  id: 1,
  email: 'coach@test.com',
  fullName: 'Coach Name',
  role: 'Coach',
};

vi.mock('../api/authApi', () => ({
  authApi: {
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockedAuthApi = vi.mocked(authApiModule.authApi);

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuthApi.getMe.mockResolvedValue(mockUser);
    mockedAuthApi.login.mockResolvedValue(mockUser);
    mockedAuthApi.logout.mockResolvedValue(undefined);
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  }

  it('loads user on mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets user to null when getMe fails', async () => {
    mockedAuthApi.getMe.mockRejectedValue(new Error('Not authenticated'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.user).toBeNull();
  });

  it('login sets user', async () => {
    mockedAuthApi.getMe.mockRejectedValue(new Error('Not authenticated'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      await result.current.login('coach@test.com', 'password');
    });
    expect(result.current.user).toEqual(mockUser);
  });

  it('logout clears user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.user).toBeNull();
  });
});
