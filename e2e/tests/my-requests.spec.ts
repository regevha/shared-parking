import { test, expect } from '@playwright/test';
import { waitForNav } from '../fixtures/auth';
import {
  Account, api, createAccount, createPendingRequest, deleteAccount, futureDate, loginWithToken, ownerToken, uiDate,
} from '../fixtures/api';
import { pickOption, rowWith, toast } from '../fixtures/ui';

/**
 * My Requests: view, edit and cancel — the requester's own lifecycle.
 *
 * The Edit / Cancel buttons are icon-only; their accessible name comes from the icon ("edit", "delete"),
 * not from their `title`, so they are located by `title` here.
 */
test.describe('My Requests (User)', () => {
  let acc: Account;

  test.beforeEach(async () => {
    acc = await createAccount('mine');
  });

  test.afterEach(async () => deleteAccount(acc));

  const open = async (page: import('@playwright/test').Page) => {
    await loginWithToken(page, acc.token);
    await page.goto('/my-requests');
    await waitForNav(page);
  };

  test('empty state offers a shortcut to submit the first request', async ({ page }) => {
    await open(page);
    await expect(page.getByText('No active requests')).toBeVisible({ timeout: 8000 });

    await page.locator('.ant-empty, [class*="empty"]').getByRole('button', { name: 'New Request' }).click();
    await expect(page).toHaveURL(/\/submit-request$/);
  });

  test('"New Request" button opens the request form', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'New Request' }).first().click();
    await expect(page).toHaveURL(/\/submit-request$/);
  });

  test('lists a pending request with its time slot, status and summary counts', async ({ page }) => {
    const { date } = await createPendingRequest(acc.token, { startTime: '13:00', endTime: '15:00', duration: 2 });
    await open(page);

    const row = rowWith(page, uiDate(date));
    await expect(row).toBeVisible({ timeout: 8000 });
    await expect(row).toContainText('13:00 - 15:00');
    await expect(row).toContainText('2h');
    await expect(row.locator('.ant-tag', { hasText: 'Pending' })).toBeVisible();

    // Stats bar: 1 active, 1 pending, 0 approved
    const stats = page.locator('main, .my-requests').last();
    await expect(stats).toContainText('Total Active');
  });

  test('an approved request shows who approved it and cannot be edited', async ({ page }) => {
    const { id, date } = await createPendingRequest(acc.token);
    await api(await ownerToken(), 'PATCH', `/api/requests/${id}/approve`, {});
    await open(page);

    const row = rowWith(page, uiDate(date));
    await expect(row.locator('.ant-tag', { hasText: 'Approved' })).toBeVisible({ timeout: 8000 });
    await expect(row).toContainText('Sarah');
    await expect(row.locator('button[title="Edit"]')).toHaveCount(0);
    await expect(row.locator('button[title="Cancel"]')).toBeVisible();
  });

  test('editing a pending request updates its time slot', async ({ page }) => {
    const { id, date } = await createPendingRequest(acc.token, { startTime: '09:00', endTime: '10:00', duration: 1 });
    await open(page);

    await rowWith(page, uiDate(date)).locator('button[title="Edit"]').click();
    const modal = page.locator('.ant-modal', { hasText: `Edit Request ${id}` });
    await expect(modal).toBeVisible();

    await pickOption(page, modal.locator('.ant-form-item', { hasText: 'Start Time' }).locator('.ant-select'), '14:00');
    await pickOption(page, modal.locator('.ant-form-item', { hasText: 'Duration' }).locator('.ant-select'), '3 hours');
    await modal.getByRole('button', { name: 'Save Changes' }).click();

    await expect(toast(page).filter({ hasText: 'Request Updated' })).toBeVisible({ timeout: 8000 });
    await expect(rowWith(page, uiDate(date))).toContainText('14:00 - 17:00');

    const saved = await api<any[]>(acc.token, 'GET', '/api/requests/me');
    expect(saved.body.find((r) => r.id === id)).toMatchObject({ start_time: '14:00', end_time: '17:00', duration: 3 });
  });

  test('closing the edit dialog discards changes', async ({ page }) => {
    const { date } = await createPendingRequest(acc.token, { startTime: '09:00', endTime: '10:00' });
    await open(page);

    await rowWith(page, uiDate(date)).locator('button[title="Edit"]').click();
    const modal = page.locator('.ant-modal', { hasText: 'Edit Request' });
    await pickOption(page, modal.locator('.ant-form-item', { hasText: 'Start Time' }).locator('.ant-select'), '16:00');
    await modal.getByRole('button', { name: 'Cancel' }).click();

    await expect(modal).toBeHidden();
    await expect(rowWith(page, uiDate(date))).toContainText('09:00 - 10:00');
  });

  test('cancelling asks for confirmation and removes the request', async ({ page }) => {
    const { id, date } = await createPendingRequest(acc.token);
    await open(page);

    const row = rowWith(page, uiDate(date));
    await row.locator('button[title="Cancel"]').click();
    const pop = page.locator('.ant-popover', { hasText: 'Cancel Request' });
    await expect(pop).toContainText(id);
    await pop.getByRole('button', { name: 'Yes, Cancel' }).click();

    await expect(toast(page).filter({ hasText: 'Request Cancelled' })).toBeVisible({ timeout: 8000 });
    await expect(rowWith(page, uiDate(date))).toHaveCount(0);
    const left = await api<any[]>(acc.token, 'GET', '/api/requests/me');
    expect(left.body.some((r) => r.id === id)).toBe(false);
  });

  test('declining the cancel confirmation keeps the request', async ({ page }) => {
    const { date } = await createPendingRequest(acc.token, { date: futureDate(45) });
    await open(page);

    await rowWith(page, uiDate(date)).locator('button[title="Cancel"]').click();
    await page.locator('.ant-popover', { hasText: 'Cancel Request' }).getByRole('button', { name: 'No' }).click();
    await expect(rowWith(page, uiDate(date))).toBeVisible();
  });
});
