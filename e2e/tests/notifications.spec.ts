import { test, expect, Page } from '@playwright/test';
import { waitForNav } from '../fixtures/auth';
import {
  Account, api, createAccount, createPendingRequest, deleteAccount, futureDate, loginWithToken, managerToken, ownerToken,
} from '../fixtures/api';
import { toast } from '../fixtures/ui';

/** Notification bell in the header: unread badge, mark one / mark all read. */
test.describe('Notification bell', () => {
  let acc: Account;
  let approvedId: string;
  let rejectedId: string;

  test.beforeEach(async () => {
    acc = await createAccount('notify');
  });

  test.afterEach(async () => deleteAccount(acc));

  const bell = (page: Page) => page.locator('.notification-trigger');
  const badge = (page: Page) => page.locator('.notification-trigger .ant-badge-count');
  const popover = (page: Page) => page.locator('.notification-popover');

  const open = async (page: Page) => {
    await loginWithToken(page, acc.token);
    await page.goto('/my-requests');
    await waitForNav(page);
  };

  /** Owner decides on two of the account's requests → two notifications for the account. */
  const generateDecisions = async () => {
    const owner = await ownerToken();
    ({ id: approvedId } = await createPendingRequest(acc.token, { date: futureDate(70) }));
    ({ id: rejectedId } = await createPendingRequest(acc.token, { date: futureDate(71) }));
    await api(owner, 'PATCH', `/api/requests/${approvedId}/approve`, {});
    await api(owner, 'PATCH', `/api/requests/${rejectedId}/reject`);
  };

  test('with no activity the bell has no badge and an empty list', async ({ page }) => {
    await open(page);
    await expect(badge(page)).toHaveCount(0);

    await bell(page).click();
    await expect(popover(page)).toContainText('No notifications yet');
    await expect(popover(page).getByRole('button', { name: 'Mark all as read' })).toHaveCount(0);
  });

  test('owner decisions raise the unread badge and list the messages', async ({ page }) => {
    await generateDecisions();
    await open(page);

    await expect(badge(page)).toHaveText('2', { timeout: 8000 });

    await bell(page).click();
    await expect(popover(page).locator('.notification-item.unread')).toHaveCount(2);
    await expect(popover(page)).toContainText(`${approvedId}`);
    await expect(popover(page)).toContainText('APPROVED');
    await expect(popover(page)).toContainText(`${rejectedId}`);
    await expect(popover(page)).toContainText('rejected');
  });

  test('marking one notification as read lowers the badge by one', async ({ page }) => {
    await generateDecisions();
    await open(page);
    await expect(badge(page)).toHaveText('2', { timeout: 8000 });

    await bell(page).click();
    await popover(page).locator('.notification-item.unread').first().locator('button[title="Mark as read"]').click();

    await expect(badge(page)).toHaveText('1');
    await expect(popover(page).locator('.notification-item.unread')).toHaveCount(1);
    await expect(popover(page).locator('.notification-item.read')).toHaveCount(1);

    const list = await api<any[]>(acc.token, 'GET', '/api/notifications');
    expect(list.body.filter((n) => n.is_read)).toHaveLength(1);
  });

  test('"Mark all as read" clears the badge and persists after reload', async ({ page }) => {
    await generateDecisions();
    await open(page);
    await expect(badge(page)).toHaveText('2', { timeout: 8000 });

    await bell(page).click();
    await popover(page).getByRole('button', { name: 'Mark all as read' }).click();

    await expect(toast(page).filter({ hasText: 'Mark all as read' })).toBeVisible();
    await expect(badge(page)).toHaveCount(0);
    await expect(popover(page).locator('.notification-item.unread')).toHaveCount(0);

    await page.reload();
    await waitForNav(page);
    await expect(badge(page)).toHaveCount(0);
  });

  test('a manager broadcast reaches the user', async ({ page }) => {
    const text = `Lot A closed for cleaning ${Date.now()}`;
    const res = await api(await managerToken(), 'POST', '/api/notifications/broadcast', { audience: 'users', message: text });
    expect(res.status).toBe(200);

    await open(page);
    await expect(badge(page)).not.toHaveCount(0, { timeout: 8000 });
    await bell(page).click();
    await expect(popover(page)).toContainText(text);
  });
});
