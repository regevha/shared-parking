import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';
import { Account, api, createAccount, createPendingRequest, deleteAccount, uiDate } from '../fixtures/api';
import { confirmDialog, openNavGroup, rowWith, toast } from '../fixtures/ui';

/**
 * Owner approve / reject flows.
 *
 * Every test gets its own requester account with exactly one pending request, so the row can be found
 * by searching for that (unique) requester name — no dependence on seed data or table pagination, and
 * no more skipped tests when the DB has no pending requests.
 */
test.describe('Approve / Reject requests (Owner)', () => {
  let requester: Account;
  let requestId: string;
  let date: string;

  const statusOf = async () => {
    const res = await api<any[]>(requester.token, 'GET', '/api/requests/me');
    return res.body.find((r) => r.id === requestId)?.status;
  };

  test.beforeEach(async ({ page, request }) => {
    requester = await createAccount('approve');
    ({ id: requestId, date } = await createPendingRequest(requester.token));

    await loginAs(page, request, 'owner');
    await page.goto('/pending');
    await waitForNav(page);
    await page.getByPlaceholder(/search/i).fill(requester.name);
  });

  test.afterEach(async () => deleteAccount(requester));

  test('pending request is listed with Approve and Reject actions', async ({ page }) => {
    const row = rowWith(page, requester.name);
    await expect(row).toBeVisible({ timeout: 8000 });
    await expect(row).toContainText(uiDate(date));
    await expect(row.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Reject' })).toBeVisible();
  });

  test('search by requester name hides other requests', async ({ page }) => {
    await expect(rowWith(page, requester.name)).toBeVisible({ timeout: 8000 });
    await expect(page.locator('tr.ant-table-row')).toHaveCount(1);

    await page.getByPlaceholder(/search/i).fill('no-such-requester-zzz');
    await expect(page.locator('tr.ant-table-row')).toHaveCount(0);
  });

  test('approve asks for confirmation and cancelling leaves the request pending', async ({ page }) => {
    await rowWith(page, requester.name).getByRole('button', { name: 'Approve' }).click();

    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('Approve parking request from');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    await expect(rowWith(page, requester.name)).toBeVisible();
    expect(await statusOf()).toBe('pending');
  });

  test('approving a request removes it from Pending and lists it under Approvals', async ({ page }) => {
    await rowWith(page, requester.name).getByRole('button', { name: 'Approve' }).click();
    await confirmDialog(page).getByRole('button', { name: 'Approve' }).click();

    await expect(toast(page).filter({ hasText: /approved/i })).toBeVisible({ timeout: 8000 });
    await expect(rowWith(page, requester.name)).toHaveCount(0);
    expect(await statusOf()).toBe('approved');

    await openNavGroup(page, 'Review');
    await page.getByRole('menuitem', { name: 'Approvals' }).click();
    await page.getByPlaceholder(/search/i).fill(requester.name);
    const approved = rowWith(page, requester.name);
    await expect(approved).toBeVisible({ timeout: 8000 });
    await expect(approved).toContainText(uiDate(date));
  });

  test('rejecting a request hides it by default; "Show all" brings it back and it can still be re-approved', async ({ page }) => {
    await rowWith(page, requester.name).getByRole('button', { name: 'Reject' }).click();

    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('Reject parking request from');
    await dialog.getByRole('button', { name: 'Reject' }).click();

    await expect(toast(page).filter({ hasText: /rejected/i })).toBeVisible({ timeout: 8000 });
    expect(await statusOf()).toBe('rejected');

    // Owners hide requests they already rejected by default...
    await expect(rowWith(page, requester.name)).toHaveCount(0);
    // ...but can show them again, flagged as rejected, with Approve still available
    await page.getByText('Show all', { exact: true }).click();
    const row = rowWith(page, requester.name);
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(page.getByText(/= Rejected by you/)).toBeVisible();
  });

  test('requester is notified about the decision', async ({ page }) => {
    await rowWith(page, requester.name).getByRole('button', { name: 'Approve' }).click();
    await confirmDialog(page).getByRole('button', { name: 'Approve' }).click();
    await expect(toast(page).filter({ hasText: /approved/i })).toBeVisible({ timeout: 8000 });

    const res = await api<any[]>(requester.token, 'GET', '/api/notifications');
    expect(res.body.some((n) => n.message.includes(requestId) && /APPROVED/.test(n.message))).toBe(true);
  });
});
