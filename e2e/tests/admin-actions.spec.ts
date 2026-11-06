import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';
import { Account, api, createAccount, createPendingRequest, deleteAccount, E2E_PASSWORD, API, loginWithToken } from '../fixtures/api';
import { pickOption, rowWith, toast } from '../fixtures/ui';

/** Manager actions in the Admin Panel that change data: roles, user deletion, broadcast, reports. */
test.describe('Admin Panel actions (Manager)', () => {
  let target: Account;

  test.beforeEach(async ({ page, request }) => {
    target = await createAccount('admin-target');
    await loginAs(page, request, 'manager');
    await page.goto('/admin');
    await waitForNav(page);
  });

  test.afterEach(async () => deleteAccount(target));

  test('lists a newly registered user with the User role', async ({ page }) => {
    const row = rowWith(page, target.name);
    await expect(row).toBeVisible({ timeout: 8000 });
    await expect(row).toContainText(target.email);
    await expect(row.locator('.ant-select')).toContainText('User');
  });

  test('changing a role to Owner takes effect for that user', async ({ page }) => {
    const row = rowWith(page, target.name);
    await expect(row).toBeVisible({ timeout: 8000 });
    await pickOption(page, row.locator('.ant-select'), 'Owner');

    await expect(toast(page).filter({ hasText: 'Role updated' })).toBeVisible({ timeout: 8000 });

    const me = await api(target.token, 'GET', '/auth/me');
    expect(me.body.role).toBe('owner');
  });

  test('a promoted user gets the owner navigation on next sign-in', async ({ page, browser }) => {
    const row = rowWith(page, target.name);
    await expect(row).toBeVisible({ timeout: 8000 });
    await pickOption(page, row.locator('.ant-select'), 'Owner');
    await expect(toast(page).filter({ hasText: 'Role updated' })).toBeVisible({ timeout: 8000 });

    // Fresh login so the JWT carries the new role
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent(target.email)}&password=${E2E_PASSWORD}`,
    });
    const { access_token } = await res.json();

    const ctx = await browser.newContext();
    const ownerPage = await ctx.newPage();
    await loginWithToken(ownerPage, access_token);
    await ownerPage.goto('/my-lots');
    await waitForNav(ownerPage);
    // The page is reachable only for owners (no "My Lots" menu entry is asserted: the horizontal
    // nav collapses its last entries into a "···" overflow menu at this width).
    await expect(ownerPage.getByRole('heading', { name: 'My Lots' })).toBeVisible({ timeout: 8000 });
    await expect(ownerPage.getByText('You do not currently own any lots.')).toBeVisible();
    await expect(ownerPage.getByRole('menuitem', { name: 'Admin Panel' })).toHaveCount(0);
    await ctx.close();
  });

  test('manager accounts cannot have their role changed here', async ({ page }) => {
    const adminRow = rowWith(page, 'admin@parking.dev');
    await expect(adminRow).toBeVisible({ timeout: 8000 });
    await expect(adminRow.locator('.ant-select')).toHaveClass(/ant-select-disabled/);
  });

  test('deleting a user asks for confirmation and removes the account', async ({ page }) => {
    const row = rowWith(page, target.name);
    await expect(row).toBeVisible({ timeout: 8000 });

    await row.getByRole('button', { name: /delete/i }).click();
    const pop = page.locator('.ant-popover', { hasText: 'Delete this user?' });
    await expect(pop).toContainText('This cannot be undone.');

    // Declining keeps the user
    await pop.getByRole('button', { name: 'No' }).or(pop.getByRole('button', { name: 'Cancel' })).click();
    await expect(rowWith(page, target.name)).toBeVisible();

    // Confirming removes it
    await rowWith(page, target.name).getByRole('button', { name: /delete/i }).click();
    await page.locator('.ant-popover', { hasText: 'Delete this user?' }).getByRole('button', { name: 'Delete' }).click();
    await expect(toast(page).filter({ hasText: 'User deleted' })).toBeVisible({ timeout: 8000 });
    await expect(rowWith(page, target.name)).toHaveCount(0);

    const login = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent(target.email)}&password=${E2E_PASSWORD}`,
    });
    expect(login.status).toBe(401);
  });

  test('broadcast delivers a message to the chosen audience', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'Broadcast' }).click();

    const send = page.getByRole('button', { name: 'Send Global Alert' });
    await expect(send).toBeDisabled(); // nothing typed yet

    const text = `Maintenance tonight ${Date.now()}`;
    await pickOption(page, page.locator('.ant-select').filter({ has: page.locator('[aria-label="Target Audience:"]') }), 'All Users');
    await page.getByPlaceholder('Type your system-wide message here...').fill(text);
    await expect(send).toBeEnabled();
    await send.click();

    await expect(toast(page).filter({ hasText: 'Alert Disseminated' })).toBeVisible({ timeout: 8000 });
    const inbox = await api<any[]>(target.token, 'GET', '/api/notifications');
    expect(inbox.body.some((n) => n.message.includes(text))).toBe(true);
  });

  test('simulated blackout disables broadcasting', async ({ page }) => {
    await page.getByRole('menuitem', { name: 'Broadcast' }).click();
    await page.getByPlaceholder('Type your system-wide message here...').fill('Should not be sent');
    await expect(page.getByRole('button', { name: 'Send Global Alert' })).toBeEnabled();

    await page.getByRole('switch').click();
    await expect(page.getByText('System Blackout Active')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Global Alert' })).toBeDisabled();
  });

  test('Reports splits requests by status tab and counts a newly submitted request', async ({ page }) => {
    const countOf = async (name: RegExp) => {
      const label = await page.getByRole('tab', { name }).innerText();
      return Number(/\((\d+)\)/.exec(label)![1]);
    };
    const openReports = async () => {
      await page.getByRole('menuitem', { name: 'Reports' }).click();
      await expect(page.getByRole('tab', { name: /^All \(\d+\)/ })).toBeVisible({ timeout: 8000 });
    };

    await openReports();
    for (const tab of [/^Pending \(\d+\)/, /^Approved \(\d+\)/, /^Rejected \(\d+\)/]) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
    const [allBefore, pendingBefore] = [await countOf(/^All \(/), await countOf(/^Pending \(/)];

    // A request dated today falls inside whatever date range the report defaults to
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await createPendingRequest(target.token, { date: today });

    await page.reload();
    await waitForNav(page);
    await openReports();
    expect(await countOf(/^All \(/)).toBe(allBefore + 1);
    expect(await countOf(/^Pending \(/)).toBe(pendingBefore + 1);
  });
});
