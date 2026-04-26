import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Owner flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Mike (o2) — he has pending requests from other users he can approve
    await loginAs(page, 'o2@parking.dev', 'password123');
  });

  test('can navigate to Pending Requests and see approve/reject buttons', async ({ page }) => {
    await page.getByRole('menuitem', { name: /pending requests/i }).click();
    await expect(page).toHaveURL(/\/pending/);

    // Owners see Approve/Reject buttons for requests they didn't make themselves.
    // The seed includes pending requests from various users — at least one Approve button should appear.
    const approveButton = page.getByRole('button', { name: /approve/i }).first();
    await expect(approveButton).toBeVisible({ timeout: 5_000 });
  });

  test('can approve a pending request', async ({ page }) => {
    await page.getByRole('menuitem', { name: /pending requests/i }).click();
    await expect(page).toHaveURL(/\/pending/);

    // Click the first available Approve button
    await page.getByRole('button', { name: /approve/i }).first().click();

    // A confirmation modal appears
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 3_000 });
    await expect(modal).toContainText(/approve/i);

    // Confirm
    await modal.getByRole('button', { name: /^approve$/i }).click();

    // A success notification should appear
    await expect(page.locator('.ant-notification')).toBeVisible({ timeout: 8_000 });
  });

  test('can navigate to Approvals and see approved requests', async ({ page }) => {
    await page.getByRole('menuitem', { name: /^approvals$/i }).click();
    await expect(page).toHaveURL(/\/approvals/);

    // The seed includes approved requests — the table should have at least one row
    const tableRow = page.locator('.ant-table-row').first();
    await expect(tableRow).toBeVisible({ timeout: 5_000 });
  });

  test('owner can see Lot Calendar menu item', async ({ page }) => {
    const lotCalendar = page.getByRole('menuitem', { name: /lot calendar/i });
    await expect(lotCalendar).toBeVisible();
  });

  test('owner cannot see Admin Panel menu item', async ({ page }) => {
    const adminMenuItem = page.getByRole('menuitem', { name: /admin panel/i });
    await expect(adminMenuItem).not.toBeVisible();
  });
});
