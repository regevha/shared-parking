import { test, expect, Page } from '@playwright/test';
import { waitForNav } from '../fixtures/auth';
import { Account, createAccount, deleteAccount, createPendingRequest, futureDate, loginWithToken, uiDate } from '../fixtures/api';
import { pickOption, rowWith, toast } from '../fixtures/ui';

async function fillRequestForm(page: Page, date: string, start: string, hours: number) {
  const dateInput = page.locator('.ant-picker input').first();
  await dateInput.click();
  await dateInput.fill(date);
  await page.keyboard.press('Enter');
  await pickOption(page, page.locator('.ant-form-item', { hasText: 'Start Time' }).locator('.ant-select'), start);
  await pickOption(
    page,
    page.locator('.ant-form-item', { hasText: 'Duration' }).locator('.ant-select'),
    hours === 1 ? '1 hour' : `${hours} hours`,
  );
}

test.describe('Submit parking request (User)', () => {
  let acc: Account;
  const submit = (page: Page) => page.getByRole('button', { name: 'Submit Request' });

  test.beforeEach(async ({ page }) => {
    acc = await createAccount('submit');
    await loginWithToken(page, acc.token);
    await page.goto('/submit-request');
    await waitForNav(page);
  });

  test.afterEach(async () => deleteAccount(acc));

  test('form renders with required fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Submit Parking Request' })).toBeVisible();
    for (const label of ['Parking Date', 'Start Time', 'Duration']) {
      await expect(page.locator('label', { hasText: label })).toBeVisible();
    }
    await expect(submit(page)).toBeVisible();
  });

  test('submit stays disabled until date, start time and duration are chosen', async ({ page }) => {
    await expect(submit(page)).toBeDisabled();

    await fillRequestForm(page, futureDate(40), '09:00', 2);
    await expect(submit(page)).toBeEnabled();
  });

  test('end time is calculated from start time + duration', async ({ page }) => {
    await fillRequestForm(page, futureDate(41), '09:00', 2);
    await expect(page.locator('.ant-form-item', { hasText: 'End Time' })).toContainText('11:00');
  });

  test('a request that runs past midnight shows the next-day end date', async ({ page }) => {
    await fillRequestForm(page, futureDate(42), '22:00', 6);
    const endTime = page.locator('.ant-form-item', { hasText: 'End Time' });
    await expect(endTime).toContainText('04:00');
    // Blue tag with the (DD/MM) end date marks the multi-day request
    await expect(endTime.locator('.ant-tag')).toBeVisible();
  });

  test('successfully submits a valid request and it shows up in My Requests', async ({ page }) => {
    const date = futureDate(43);
    await fillRequestForm(page, date, '09:00', 2);
    await submit(page).click();

    await expect(toast(page).filter({ hasText: 'Request Submitted' })).toBeVisible({ timeout: 8000 });

    await page.goto('/my-requests');
    const row = rowWith(page, uiDate(date));
    await expect(row).toBeVisible({ timeout: 8000 });
    await expect(row).toContainText('09:00 - 11:00');
    await expect(row.locator('.ant-tag', { hasText: 'Pending' })).toBeVisible();
  });

  test('form is locked with a warning once the pending-request limit is reached', async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      await createPendingRequest(acc.token, { date: futureDate(60 + i) });
    }
    await page.goto('/submit-request');
    await waitForNav(page);

    await expect(page.getByText('Request Limit Reached')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /Cannot Submit/ })).toBeDisabled();
  });
});
