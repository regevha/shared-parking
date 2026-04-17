import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';

test.describe('Approve / Reject requests (Owner)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'owner');
    await page.goto('/pending');
    await waitForNav(page);
  });

  test('pending requests page renders a table or empty state', async ({ page }) => {
    // Either the table with requests or the empty-state component must be present
    const table = page.locator('.ant-table-tbody tr, .pending-card');
    const emptyState = page.locator('.ant-empty, [data-testid="empty-state"]');
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: 8000 });
  });

  test('approve button triggers confirmation modal', async ({ page }) => {
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    const hasPending = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasPending) {
      test.skip(); // no pending requests in DB — re-seed and retry
      return;
    }

    await approveBtn.click();
    // Modal.confirm renders in a portal — look for the dialog
    await expect(page.getByRole('button', { name: /ok/i })).toBeVisible({ timeout: 5000 });
    // Dismiss without confirming to avoid mutating DB state
    await page.getByRole('button', { name: /cancel/i }).click();
  });

  test('reject button triggers confirmation modal', async ({ page }) => {
    const rejectBtn = page.getByRole('button', { name: /reject/i }).first();
    const hasPending = await rejectBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasPending) {
      test.skip();
      return;
    }

    await rejectBtn.click();
    await expect(page.getByRole('button', { name: /ok/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /cancel/i }).click();
  });

  test('approving a request removes it from the pending list', async ({ page }) => {
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    const hasPending = await approveBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasPending) {
      test.skip();
      return;
    }

    // Count rows before approval
    const rowsBefore = await page.locator('.ant-table-tbody tr:not(.ant-table-placeholder)').count();

    await approveBtn.click();
    await page.getByRole('button', { name: /ok/i }).click();

    // Row count should decrease (or empty state appears if it was the last one)
    await page.waitForTimeout(1000);
    const rowsAfter = await page.locator('.ant-table-tbody tr:not(.ant-table-placeholder)').count();
    expect(rowsAfter).toBeLessThan(rowsBefore);
  });
});
