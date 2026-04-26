import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';

test.describe('Admin Panel (Manager)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'manager');
    await page.goto('/admin');
    await waitForNav(page);
  });

  test('admin panel renders without errors', async ({ page }) => {
    // The Layout with sidebar menu should be present
    await expect(page.locator('.ant-layout-sider, .ant-menu')).toBeVisible({ timeout: 8000 });
  });

  test('Users tab shows a table with at least one user row', async ({ page }) => {
    // Users is the default selected menu item
    await expect(page.getByText('Users').first()).toBeVisible();
    await expect(
      page.locator('.ant-table-tbody tr:not(.ant-table-placeholder)').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('switching to Lots tab renders lots table', async ({ page }) => {
    await page.getByRole('menuitem', { name: /lots/i }).first().click();
    await expect(
      page.locator('.ant-table-tbody tr:not(.ant-table-placeholder)').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('switching to Reports tab renders requests table', async ({ page }) => {
    await page.getByRole('menuitem', { name: /reports/i }).click();
    // Table or empty state must appear
    await expect(
      page.locator('.ant-table, .ant-empty').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('Config tab has Run Auto-Approval button', async ({ page }) => {
    await page.getByRole('menuitem', { name: /config/i }).click();
    await expect(page.getByRole('button', { name: /auto.approval/i })).toBeVisible({ timeout: 8000 });
  });
});
