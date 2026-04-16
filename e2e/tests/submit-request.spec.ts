import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';
import dayjs from 'dayjs';

test.describe('Submit parking request (User)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'user');
    await page.goto('/submit-request');
    await waitForNav(page);
  });

  test('form renders with required fields', async ({ page }) => {
    await expect(page.getByText('Date')).toBeVisible();
    await expect(page.getByText('Start Time')).toBeVisible();
    await expect(page.getByText('Duration')).toBeVisible();
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
  });

  test('submitting without a date shows validation error', async ({ page }) => {
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
  });

  test('successfully submits a valid request', async ({ page }) => {
    // Use a date well in the future to avoid conflicts
    const futureDate = dayjs().add(30, 'day').format('YYYY-MM-DD');

    // Fill the date picker by typing directly into the input
    const dateInput = page.locator('.ant-picker input').first();
    await dateInput.click();
    await dateInput.fill(futureDate);
    await page.keyboard.press('Escape');

    // Start time — select the first available option from the Select
    await page.locator('.ant-select').first().click();
    await page.getByRole('option').first().click();

    // Duration — default value is pre-selected (1h); leave as-is
    await page.getByRole('button', { name: /submit/i }).click();

    // Success notification or redirect back to My Requests
    await expect(
      page.locator('.ant-notification-notice, .ant-message-success').first()
    ).toBeVisible({ timeout: 8000 });
  });
});
