import { test, expect } from '@playwright/test';
import { waitForNav } from '../fixtures/auth';
import {
  Account, api, createAccount, createPendingRequest, deleteAccount, futureDate, loginWithToken, managerToken, ownerToken, uiDate,
} from '../fixtures/api';

/** Request detail page + the per-request message thread between requester and owners. */
test.describe('Request detail & messages', () => {
  let acc: Account;
  let requestId: string;
  let date: string;

  test.beforeEach(async () => {
    acc = await createAccount('detail');
    ({ id: requestId, date } = await createPendingRequest(acc.token, { startTime: '10:00', endTime: '12:00', duration: 2 }));
  });

  test.afterEach(async () => deleteAccount(acc));

  const openAs = async (page: import('@playwright/test').Page, token: string) => {
    await loginWithToken(page, token);
    await page.goto(`/request/${requestId}`);
    await waitForNav(page);
  };

  const input = (page: import('@playwright/test').Page) => page.getByPlaceholder('Type your message...');
  const sendBtn = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Send' });

  test('requester sees the request details', async ({ page }) => {
    await openAs(page, acc.token);
    const info = page.locator('.ant-card', { hasText: 'Request Info' }).first();
    await expect(info).toContainText(requestId, { timeout: 8000 });
    await expect(info).toContainText(acc.name);
    await expect(info).toContainText(uiDate(date));
    await expect(info).toContainText('10:00 - 12:00');
    await expect(info.locator('.ant-tag', { hasText: 'Pending' })).toBeVisible();
  });

  test('an approved request also shows the assigned lot, floor and owner', async ({ page }) => {
    // Own date so the lot assignment can't collide with other tests (a lot can't be double-booked).
    const { id } = await createPendingRequest(acc.token, { date: futureDate(300), startTime: '08:00', endTime: '09:00' });
    // Managers may assign a lot regardless of its owner's availability windows.
    const res = await api(await managerToken(), 'PATCH', `/api/requests/${id}/approve`, {
      lot_id: 'LOT-202', floor: 'Floor 2', lot_owner: 'Mike',
    });
    expect(res.status).toBe(200);

    await loginWithToken(page, acc.token);
    await page.goto(`/request/${id}`);
    await waitForNav(page);

    const info = page.locator('.ant-card', { hasText: 'Request Info' }).first();
    await expect(info.locator('.ant-tag', { hasText: 'Approved' })).toBeVisible({ timeout: 8000 });
    await expect(info).toContainText('LOT-202');
    await expect(info).toContainText('Floor 2');
    await expect(info).toContainText('Mike');
  });

  test('unknown request id shows a not-found card with a way back', async ({ page }) => {
    await loginWithToken(page, acc.token);
    await page.goto('/request/REQ-DOES-NOT-EXIST');
    await waitForNav(page);
    await expect(page.getByRole('button', { name: /go back/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('REQ-DOES-NOT-EXIST')).toBeVisible();
  });

  test('empty thread invites the first message and Send is disabled until text is typed', async ({ page }) => {
    await openAs(page, acc.token);
    await expect(page.getByText('No messages yet')).toBeVisible({ timeout: 8000 });
    await expect(sendBtn(page)).toBeDisabled();

    await input(page).fill('   ');
    await expect(sendBtn(page)).toBeDisabled();

    await input(page).fill('Hello');
    await expect(sendBtn(page)).toBeEnabled();
  });

  test('requester can post a message; it persists across reloads', async ({ page }) => {
    await openAs(page, acc.token);
    await input(page).fill('Can I have a spot near the lift?');
    await sendBtn(page).click();

    const message = page.locator('.message', { hasText: 'Can I have a spot near the lift?' });
    await expect(message).toBeVisible({ timeout: 8000 });
    await expect(message).toContainText(acc.name);
    await expect(input(page)).toHaveValue('');

    await page.reload();
    await expect(page.locator('.message', { hasText: 'Can I have a spot near the lift?' })).toBeVisible({ timeout: 8000 });
  });

  test('pressing Enter sends the message', async ({ page }) => {
    await openAs(page, acc.token);
    await input(page).fill('Sent with Enter');
    await input(page).press('Enter');
    await expect(page.locator('.message', { hasText: 'Sent with Enter' })).toBeVisible({ timeout: 8000 });
  });

  test('owner sees the requester message and can reply in the same thread', async ({ page }) => {
    await api(acc.token, 'POST', `/api/requests/${requestId}/messages`, { text: 'Is 10:00 flexible?' });

    await openAs(page, await ownerToken());
    await expect(page.locator('.message', { hasText: 'Is 10:00 flexible?' })).toBeVisible({ timeout: 8000 });

    await input(page).fill('Yes, any time after 09:00 works.');
    await sendBtn(page).click();
    await expect(page.locator('.message', { hasText: 'Yes, any time after 09:00 works.' })).toBeVisible({ timeout: 8000 });

    // ...and the requester sees the reply
    const thread = await api<any[]>(acc.token, 'GET', `/api/requests/${requestId}/messages`);
    expect(thread.body.map((m) => m.text)).toEqual(['Is 10:00 flexible?', 'Yes, any time after 09:00 works.']);
  });

  test('another regular user cannot read the thread', async () => {
    const stranger = await createAccount('stranger');
    try {
      const res = await api(stranger.token, 'GET', `/api/requests/${requestId}/messages`);
      expect(res.status).toBe(403);
    } finally {
      await deleteAccount(stranger);
    }
  });
});
