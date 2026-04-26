import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Authentication', () => {
  test('login with valid credentials shows app shell', async ({ page }) => {
    await loginAs(page, 'o1@parking.dev', 'password123');
    // The navigation header should be visible after login
    await expect(page.locator('.ant-layout-header')).toBeVisible();
  });

  test('login with wrong password shows error message', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[autocomplete="email"]').fill('o1@parking.dev');
    await page.locator('input[autocomplete="current-password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Ant Design Alert renders the error message
    await expect(page.locator('.ant-alert-message')).toBeVisible({ timeout: 5_000 });
    // Should remain on the login page (email input still visible)
    await expect(page.locator('input[autocomplete="email"]')).toBeVisible();
  });

  test('logout redirects to login page', async ({ page }) => {
    await loginAs(page, 'o1@parking.dev', 'password123');

    // The user button shows the name — click to open the logout dropdown
    await page.getByRole('button', { name: /sarah/i }).click();
    await page.getByText(/sign out/i).click();

    // After logout the app shell disappears and the login form appears
    await expect(page.locator('input[autocomplete="email"]')).toBeVisible({ timeout: 5_000 });
  });
});
