import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';
import { Account, createAccount, createPendingRequest, deleteAccount, loginWithToken } from '../fixtures/api';

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test.describe('Requests View (calendar)', () => {
  let acc: Account;

  test.beforeEach(async () => {
    acc = await createAccount('calendar');
  });

  test.afterEach(async () => deleteAccount(acc));

  test('renders the calendar with Day / Week / Month views and a Today shortcut', async ({ page }) => {
    await loginWithToken(page, acc.token);
    await page.goto('/calendar');
    await waitForNav(page);

    await expect(page.locator('.rbc-calendar')).toBeVisible({ timeout: 8000 });
    for (const view of ['Day', 'Week', 'Month']) {
      await expect(page.getByRole('button', { name: view, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
  });

  test('switching views changes the calendar layout', async ({ page }) => {
    await loginWithToken(page, acc.token);
    await page.goto('/calendar');
    await waitForNav(page);
    await expect(page.locator('.rbc-calendar')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await expect(page.locator('.rbc-month-view')).toBeVisible();

    await page.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(page.locator('.rbc-time-view')).toBeVisible();

    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await expect(page.locator('.rbc-time-view')).toBeVisible();
    await expect(page.locator('.rbc-day-slot')).toHaveCount(1);
  });

  test('a request for today appears as an event on the calendar', async ({ page }) => {
    await createPendingRequest(acc.token, { date: todayIso(), startTime: '12:00', endTime: '13:00' });
    await loginWithToken(page, acc.token);
    await page.goto('/calendar');
    await waitForNav(page);

    // Events are titled with the requester's first name only ("E2E"), so match on name + time slot
    await expect(page.locator('.custom-event', { hasText: 'E2E' }).filter({ hasText: '12:00–13:00' }).first())
      .toBeVisible({ timeout: 8000 });
  });
});

test.describe('Lot Calendar (Owner)', () => {
  test('renders the lot calendar with a lot selector and views', async ({ page, request }) => {
    await loginAs(page, request, 'owner');
    await page.goto('/lot-calendar');
    await waitForNav(page);

    await expect(page.locator('.rbc-calendar')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Month', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await expect(page.locator('.rbc-month-view')).toBeVisible();
  });

  test('regular users are not offered the Lot Calendar', async ({ page, request }) => {
    await loginAs(page, request, 'user');
    await page.goto('/my-requests');
    await waitForNav(page);
    await expect(page.getByRole('menuitem', { name: 'Lot Calendar' })).toHaveCount(0);
  });
});
