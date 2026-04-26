import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Admin / Manager flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as David (a1) — Manager role
    await loginAs(page, 'a1@parking.dev', 'password123');
  });

  test('can navigate to Admin Panel', async ({ page }) => {
    await page.getByRole('menuitem', { name: /admin panel/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('Admin Panel Users tab shows a user list', async ({ page }) => {
    await page.goto('/admin');

    // The Admin Panel has tabs — click the Users tab if not already active
    const usersTab = page.getByRole('tab', { name: /users/i });
    await expect(usersTab).toBeVisible({ timeout: 5_000 });
    await usersTab.click();

    // The table should show at least one row (the seeded users)
    const firstRow = page.locator('.ant-table-row').first();
    await expect(firstRow).toBeVisible({ timeout: 5_000 });
  });

  test('manager can see Lot Calendar menu item', async ({ page }) => {
    const lotCalendar = page.getByRole('menuitem', { name: /lot calendar/i });
    await expect(lotCalendar).toBeVisible();
  });

  test('manager can see Admin Panel menu item', async ({ page }) => {
    const adminMenuItem = page.getByRole('menuitem', { name: /admin panel/i });
    await expect(adminMenuItem).toBeVisible();
  });

  test('manager can see all main nav items', async ({ page }) => {
    // All roles see these items
    await expect(page.getByRole('menuitem', { name: /requests view/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /pending requests/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /^approvals$/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /parking status/i })).toBeVisible();

    // Manager-only items
    await expect(page.getByRole('menuitem', { name: /lot calendar/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /admin panel/i })).toBeVisible();
  });
});
