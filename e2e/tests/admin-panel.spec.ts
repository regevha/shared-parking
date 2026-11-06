import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';
import { tableRows } from '../fixtures/ui';

test.describe('Admin Panel (Manager)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'manager');
    await page.goto('/admin');
    await waitForNav(page);
  });

  test('admin panel renders its section menu', async ({ page }) => {
    for (const section of ['User Management', 'Lot Management', 'Import / Export', 'System Configuration', 'Reports', 'Broadcast']) {
      await expect(page.getByRole('menuitem', { name: section })).toBeVisible({ timeout: 8000 });
    }
  });

  test('Users section shows a table with at least one user row', async ({ page }) => {
    await expect(tableRows(page).first()).toBeVisible({ timeout: 8000 });
  });

  test('switching to Lots section renders lots table', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'Lot Management' }).click();
    await expect(tableRows(page).first()).toBeVisible({ timeout: 8000 });
  });

  test('switching to Reports section renders requests table', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'Reports' }).click();
    // Table or empty state must appear
    await expect(page.locator('.ant-table, .ant-empty').first()).toBeVisible({ timeout: 8000 });
  });

  test('Config section has Run Auto-Approval button', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'System Configuration' }).click();
    await expect(page.getByRole('button', { name: /auto.approval/i })).toBeVisible({ timeout: 8000 });
  });
});
