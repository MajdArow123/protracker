import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { LoginPage } from '../pages/auth/LoginPage';
import { AuthContext } from '../context/AuthContext';
import type { User } from '../types';

function renderLogin(login = vi.fn().mockResolvedValue({ id: '1', email: 'a@b.com', fullName: 'A', role: 'Coach' } as User)) {
  const ctx = { user: null as User | null, isLoading: false, login, logout: vi.fn(), register: vi.fn() };
  render(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <AuthContext.Provider value={ctx as any}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { login };
}

// "Sign In" appears twice (the tab + the submit button); grab the actual submit.
function submitButton(): HTMLElement {
  const btn = screen.getAllByRole('button', { name: /sign in/i }).find(b => b.getAttribute('type') === 'submit');
  if (!btn) throw new Error('submit button not found');
  return btn;
}

describe('LoginPage', () => {
  it('renders the sign-in form', () => {
    renderLogin();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    // Fields carry real <label>s since FINDING-003 (placeholders are just hints).
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
  });

  it('submits the entered credentials to login()', async () => {
    const user = userEvent.setup();
    const { login } = renderLogin();
    await user.type(screen.getByLabelText('Email address'), 'coach@test.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(submitButton());
    expect(login).toHaveBeenCalledWith('coach@test.com', 'secret123');
  });
});
