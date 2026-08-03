import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../context/useAuth';
import * as authApiModule from '../api/authApi';
import { tokenStorage } from '../api/axiosInstance';
import type { User } from '../types';

const mockUser: User = { id: 'user-1', email: 'coach@test.com', fullName: 'Coach Name', role: 'Coach' };

vi.mock('../api/authApi', () => ({
  authApi: { getMe: vi.fn(), login: vi.fn(), logout: vi.fn(), register: vi.fn() },
}));

const mockedAuthApi = vi.mocked(authApiModule.authApi);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // A stored token makes the provider attempt getMe on mount.
    tokenStorage.setAccess('stored-token');
    mockedAuthApi.getMe.mockResolvedValue(mockUser);
    mockedAuthApi.login.mockResolvedValue(mockUser);
    mockedAuthApi.logout.mockResolvedValue(undefined);
  });

  it('loads the current user on mount when a token exists', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await settle();
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
  });

  it('clears the user when getMe fails', async () => {
    mockedAuthApi.getMe.mockRejectedValue(new Error('Not authenticated'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await settle();
    expect(result.current.user).toBeNull();
  });

  it('login sets the user', async () => {
    mockedAuthApi.getMe.mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await settle();
    await act(async () => { await result.current.login('coach@test.com', 'pw'); });
    expect(result.current.user).toEqual(mockUser);
  });

  it('logout clears the user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await settle();
    await act(async () => { await result.current.logout(); });
    expect(result.current.user).toBeNull();
  });
});
