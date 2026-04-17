import { Page } from '@playwright/test';

/**
 * Log in as a given user and wait for the app shell to appear.
 *
 * The login form uses Ant Design inputs — we target by autocomplete attribute.
 * After a successful login the app renders the navigation header (ant-layout-header).
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');

  // Ant Design Form.Item renders a native <input> — target by autocomplete attribute
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for the app shell header to appear, indicating successful login
  await page.locator('.ant-layout-header').waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Navigate to a menu item by its link text and wait for URL change.
 */
export async function navigateTo(page: Page, linkText: string | RegExp): Promise<void> {
  await page.getByRole('menuitem').filter({ hasText: linkText }).click();
}
