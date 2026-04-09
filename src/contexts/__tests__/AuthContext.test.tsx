import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import * as authApiModule from '../../api/auth';

// ── Mock authApi ──────────────────────────────────────────────────────────────

jest.mock('../../api/auth', () => ({
  authApi: {
    login: jest.fn(),
    me: jest.fn(),
  },
}));

const mockAuthApi = authApiModule.authApi as jest.Mocked<typeof authApiModule.authApi>;

// ── Test harness component ────────────────────────────────────────────────────

function AuthHarness() {
  const { user, token, authLoading, login, logout, updateUser } = useAuth();
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const handleLogin = async () => {
    setLoginError(null);
    try { await login('a@b.com', 'pw'); }
    catch (e: any) { setLoginError(e.message); }
  };
  return (
    <div>
      <div data-testid="user">{user ? user.name : 'null'}</div>
      <div data-testid="token">{token ?? 'null'}</div>
      <div data-testid="loading">{String(authLoading)}</div>
      <div data-testid="login-error">{loginError ?? ''}</div>
      <button onClick={handleLogin}>login</button>
      <button onClick={logout}>logout</button>
      <button onClick={() => updateUser({ name: 'Updated' })}>update</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthHarness />
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthContext — initial load', () => {
  it('sets user to null and authLoading to false when no token', async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('validates stored token on mount and sets user', async () => {
    localStorage.setItem('parking_token', 'valid-token');
    mockAuthApi.me.mockResolvedValueOnce({
      id: 'u-1', name: 'Alice', email: 'a@b.com', role: 'user',
      preferences: { darkMode: false, availabilityWindows: {}, notificationWindows: {}, language: 'en' },
    });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('clears token and sets user null when stored token is invalid', async () => {
    localStorage.setItem('parking_token', 'bad-token');
    mockAuthApi.me.mockRejectedValueOnce(new Error('Token invalid'));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(localStorage.getItem('parking_token')).toBeNull();
  });
});

describe('AuthContext — login', () => {
  it('stores token in localStorage and sets user on successful login', async () => {
    mockAuthApi.login.mockResolvedValueOnce({
      access_token: 'tok-xyz', token_type: 'bearer',
      id: 'u-2', name: 'Bob', email: 'b@c.com', role: 'owner',
      preferences: { darkMode: true, availabilityWindows: {}, notificationWindows: {}, language: 'en' },
    });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => { screen.getByText('login').click(); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Bob'));
    expect(localStorage.getItem('parking_token')).toBe('tok-xyz');
  });

  it('does not store token when login fails', async () => {
    mockAuthApi.login.mockRejectedValueOnce(new Error('Incorrect email or password'));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await act(async () => { screen.getByText('login').click(); });
    await waitFor(() =>
      expect(screen.getByTestId('login-error').textContent).toBe('Incorrect email or password')
    );
    expect(localStorage.getItem('parking_token')).toBeNull();
    expect(screen.getByTestId('user').textContent).toBe('null');
  });
});

describe('AuthContext — logout', () => {
  it('clears localStorage token and sets user null', async () => {
    localStorage.setItem('parking_token', 'some-token');
    mockAuthApi.me.mockResolvedValueOnce({
      id: 'u-1', name: 'Alice', email: 'a@b.com', role: 'user',
      preferences: { darkMode: false, availabilityWindows: {}, notificationWindows: {}, language: 'en' },
    });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'));
    await act(async () => { screen.getByText('logout').click(); });
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('null'));
    expect(localStorage.getItem('parking_token')).toBeNull();
  });
});

describe('AuthContext — updateUser', () => {
  it('merges partial patch into existing user', async () => {
    localStorage.setItem('parking_token', 'tok');
    mockAuthApi.me.mockResolvedValueOnce({
      id: 'u-1', name: 'Alice', email: 'a@b.com', role: 'user',
      preferences: { darkMode: false, availabilityWindows: {}, notificationWindows: {}, language: 'en' },
    });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'));
    act(() => { screen.getByText('update').click(); });
    expect(screen.getByTestId('user').textContent).toBe('Updated');
  });
});

describe('useAuth — outside provider', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress expected error output
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthHarness />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
