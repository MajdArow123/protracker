import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { LoginPage } from '../pages/auth/LoginPage';
import { AuthContext } from '../context/AuthContext';
import type { User } from '../types';

const mockCtx = {
  user: null as User | null,
  isLoading: false,
  login: vi.fn().mockResolvedValue({ id: 1, email: 'a@b.com', fullName: 'A', role: 'Coach' as const }),
  logout: vi.fn(),
};

describe('LoginPage', () => {
  it('renders logo and form fields', () => {
    render(
      <AuthContext.Provider value={mockCtx}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('ProTracker')).toBeTruthy();
    expect(screen.getByText('Sign in to your account')).toBeTruthy();
    expect(screen.getByPlaceholderText('coach@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });
});
