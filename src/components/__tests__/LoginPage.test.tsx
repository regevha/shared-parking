import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notification } from 'antd';
import LoginPage from '../LoginPage';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

beforeEach(() => {
  jest.spyOn(notification, 'error').mockImplementation(() => ({ destroy: jest.fn() }));
  jest.spyOn(notification, 'success').mockImplementation(() => ({ destroy: jest.fn() }));
});

afterEach(() => { jest.restoreAllMocks(); });

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    // password is type=password, use placeholder text to find it
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    renderWithProviders(<LoginPage />);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByText(/please enter your email/i)).toBeInTheDocument();
    });
  });

  it('calls login() from AuthContext on valid submit', async () => {
    const mockLogin = jest.fn().mockResolvedValue(undefined);
    renderWithProviders(<LoginPage />, { authValue: { login: mockLogin } });

    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'test@test.com');
    await userEvent.type(document.querySelector('input[type="password"]')!, 'secret');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'secret'));
  });

  it('shows error alert when login rejects', async () => {
    const mockLogin = jest.fn().mockRejectedValue(new Error('Incorrect email or password'));
    renderWithProviders(<LoginPage />, { authValue: { login: mockLogin } });

    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'bad@test.com');
    await userEvent.type(document.querySelector('input[type="password"]')!, 'wrong');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Incorrect email or password')).toBeInTheDocument());
  });

  it('demo account tag click fills form with email and password123', async () => {
    renderWithProviders(<LoginPage />);
    // Click the Sarah demo account tag
    const sarahTag = screen.getByRole('button', { name: /Sarah/ });
    fireEvent.click(sarahTag);

    await waitFor(() => {
      const emailInput = screen.getByRole('textbox', { name: /email/i }) as HTMLInputElement;
      expect(emailInput.value).toBe('sarah@parking.dev');
    });

    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    expect(passwordInput.value).toBe('password123');
  });

  it('demo account tag is operable with the keyboard and shows its role', async () => {
    renderWithProviders(<LoginPage />);
    const sarahTag = screen.getByRole('button', { name: /Sarah/ });
    expect(sarahTag.textContent).toMatch(/owner/i);
    fireEvent.keyDown(sarahTag, { key: 'Enter' });

    await waitFor(() => {
      const emailInput = screen.getByRole('textbox', { name: /email/i }) as HTMLInputElement;
      expect(emailInput.value).toBe('sarah@parking.dev');
    });
  });

  it('shows loading state on submit button during async login', async () => {
    let resolveLogin: () => void;
    const mockLogin = jest.fn().mockReturnValue(
      new Promise<void>(res => { resolveLogin = res; })
    );
    renderWithProviders(<LoginPage />, { authValue: { login: mockLogin } });

    await userEvent.type(screen.getByRole('textbox', { name: /email/i }), 'a@b.com');
    await userEvent.type(document.querySelector('input[type="password"]')!, 'pw');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /sign in/i });
      expect(btn.closest('button')).toHaveClass('ant-btn-loading');
    });

    resolveLogin!();
  }, 20000); // userEvent.type is slow on loaded CI runners; the default 5s is too tight
});
