import { Page, APIRequestContext } from '@playwright/test';

export type Role = 'user' | 'owner' | 'manager';

export const CREDENTIALS: Record<Role, { email: string; password: string; name: string }> = {
  user:    { email: 'alice@parking.dev',  password: 'password123', name: 'Alice Johnson' },
  owner:   { email: 'sarah@parking.dev',  password: 'password123', name: 'Sarah Smith' },
  manager: { email: 'admin@parking.dev',  password: 'password123', name: 'Admin User' },
};

/**
 * Log in via the backend API and inject the JWT into localStorage.
 * AuthContext reads `parking_token` on mount and calls /auth/me, so the
 * app hydrates as the correct user without going through the login form.
 * ~10x faster than UI login.
 */
export async function loginAs(page: Page, request: APIRequestContext, role: Role): Promise<void> {
  const { email, password } = CREDENTIALS[role];

  const resp = await request.post('http://localhost:8000/auth/login', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  });

  const data = await resp.json();
  const token: string = data.access_token;

  // Navigate first to establish the correct origin for localStorage
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('parking_token', t), token);
}

/**
 * Full UI login — only used in auth.spec.ts where the login flow itself
 * is under test.
 */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

/**
 * Wait until the app has finished authenticating and the nav is visible.
 * Call this after loginAs() + page.goto(route) to ensure auth is resolved.
 */
export async function waitForNav(page: Page): Promise<void> {
  await page.getByRole('menuitem', { name: 'Parking Status' }).waitFor({ timeout: 10000 });
}
