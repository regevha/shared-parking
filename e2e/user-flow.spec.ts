import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';
import dayjs from 'dayjs';

/**
 * User-flow tests.
 *
 * The current seed has no "user" role accounts — the smallest role is "owner"
 * (o1@parking.dev = Sarah). Owners share the same restrictions as plain users
 * regarding the Admin Panel, and they can submit/view their own requests.
 * These tests validate that user-facing functionality works for a non-manager account.
 */
test.describe('User flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'o1@parking.dev', 'password123');
  });

  test('can navigate to and submit a new parking request', async ({ page }) => {
    // Go to My Requests page
    await page.getByRole('menuitem', { name: /my requests/i }).click();
    await expect(page).toHaveURL(/\/my-requests/);

    // Click "New Request" button
    await page.getByRole('button', { name: /new request/i }).click();
    await expect(page).toHaveURL(/\/submit-request/);

    // Fill the form — pick tomorrow's date
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    const dateInput = page.locator('.ant-picker input').first();
    await dateInput.fill(tomorrow);
    await dateInput.press('Enter');

    // Select start time: 09:00
    await page.getByLabel(/start time/i).click();
    await page.getByTitle('09:00').click();

    // Select duration: 2h (first option visible)
    await page.getByLabel(/duration/i).click();
    await page.getByTitle(/^2 hour/).click();

    // Submit the form
    await page.getByRole('button', { name: /submit request/i }).click();

    // Notification should appear
    await expect(page.locator('.ant-notification')).toBeVisible({ timeout: 5_000 });
  });

  test('submitted request appears in My Requests list', async ({ page }) => {
    await page.getByRole('menuitem', { name: /my requests/i }).click();
    await expect(page).toHaveURL(/\/my-requests/);

    // Sarah (o1) has seeded requests — the table or card list should show at least one
    const tableOrCards = page.locator('.ant-table-row, .my-requests-card');
    await expect(tableOrCards.first()).toBeVisible({ timeout: 5_000 });
  });

  test('owner cannot see Admin Panel menu item', async ({ page }) => {
    // Admin Panel is only visible to Manager role
    const adminMenuItem = page.getByRole('menuitem', { name: /admin panel/i });
    await expect(adminMenuItem).not.toBeVisible();
  });
});
