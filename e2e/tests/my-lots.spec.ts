import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';

test.describe('My Lots (Owner)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'owner');
    await page.goto('/my-lots');
    await waitForNav(page);
  });

  test('My Lots page renders without errors', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: /my lots/i })).toBeVisible({ timeout: 8000 });
  });

  test('lots table shows at least one lot row', async ({ page }) => {
    await expect(
      page.locator('tr.ant-table-row, .my-lots-card').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('lot status tags are present', async ({ page }) => {
    // At least one Ant Design Tag should appear in the lots table (Available / Blocked / Maintenance)
    await expect(page.locator('.ant-tag').first()).toBeVisible({ timeout: 8000 });
  });

  test('table has Lot ID, Floor, and Status columns', async ({ page }) => {
    const headers = page.locator('.ant-table-thead th');
    await expect(headers.filter({ hasText: /lot/i }).first()).toBeVisible();
    await expect(headers.filter({ hasText: /floor/i }).first()).toBeVisible();
    await expect(headers.filter({ hasText: /status/i }).first()).toBeVisible();
  });
});
