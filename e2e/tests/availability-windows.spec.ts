import { test, expect, Page } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';
import { api, futureDate, ownerToken, uiDate } from '../fixtures/api';
import { pickOption, rowWith, toast } from '../fixtures/ui';

/**
 * Availability Settings (owner): lots are blocked by default; owners open them with windows.
 * The suite adds one-time windows on a unique future date and removes them again, so the
 * owner's real recurring windows are never touched.
 */
test.describe('Availability windows (Owner)', () => {
  const LOT = 'LOT-301';
  let date: string;

  test.beforeEach(async ({ page, request }) => {
    date = futureDate(200 + Math.floor(Math.random() * 300));
    await loginAs(page, request, 'owner');
    await page.goto('/availability');
    await waitForNav(page);
    await page.getByRole('tab', { name: new RegExp(LOT) }).click();
  });

  test.afterEach(async () => {
    // Remove any window this test left behind on its unique date
    const token = await ownerToken();
    const list = await api<any[]>(token, 'GET', `/api/lots/${LOT}/availability`);
    for (const w of Array.isArray(list.body) ? list.body : []) {
      if (w.specific_date === date) await api(token, 'DELETE', `/api/lots/${LOT}/availability/${w.id}`);
    }
  });

  const addButton = (page: Page) => page.getByRole('button', { name: 'Add Window' });
  const modal = (page: Page) => page.locator('.ant-modal', { hasText: `Add Availability Window — ${LOT}` });

  async function addOneTimeWindow(page: Page, from: string, to: string) {
    await addButton(page).click();
    const dialog = modal(page);
    await expect(dialog).toBeVisible();

    await pickOption(page, dialog.locator('.ant-form-item', { hasText: 'Window Type' }).locator('.ant-select'), 'One-time (specific date)');

    const dateInput = dialog.locator('.ant-form-item', { hasText: 'Date' }).locator('.ant-picker input').first();
    await dateInput.click();
    await dateInput.fill(uiDate(date));
    await page.keyboard.press('Enter');

    const [start, end] = [
      dialog.locator('.ant-picker-range input').nth(0),
      dialog.locator('.ant-picker-range input').nth(1),
    ];
    await start.click();
    await start.fill(from);
    await page.keyboard.press('Enter');
    await end.fill(to);
    await page.keyboard.press('Enter');
    return dialog;
  }

  test('shows a tab for each of the owner\'s lots', async ({ page }) => {
    for (const lot of ['LOT-101-A', 'LOT-101-B', 'LOT-101-C', 'LOT-101-D', 'LOT-301']) {
      await expect(page.getByRole('tab', { name: new RegExp(lot) })).toBeVisible();
    }
    await expect(addButton(page)).toBeVisible();
  });

  test('the dialog validates required fields', async ({ page }) => {
    await addButton(page).click();
    const dialog = modal(page);
    await dialog.getByRole('button', { name: 'Add Window' }).click();
    await expect(dialog.locator('.ant-form-item-explain-error').first()).toBeVisible();
    await expect(dialog).toContainText('Please select a day');
    await expect(dialog).toContainText('Please select a time range');
  });

  test('end time must be after start time', async ({ page }) => {
    const dialog = await addOneTimeWindow(page, '12:00', '09:00');
    await dialog.getByRole('button', { name: 'Add Window' }).click();
    await expect(dialog).toContainText('End time must be after start time');
  });

  test('adds a one-time window, toggles it off, and removes it', async ({ page }) => {
    const dialog = await addOneTimeWindow(page, '08:00', '12:00');
    await dialog.getByRole('button', { name: 'Add Window' }).click();

    await expect(toast(page).filter({ hasText: 'Availability window added' })).toBeVisible({ timeout: 8000 });
    const row = rowWith(page, uiDate(date));
    await expect(row).toContainText('08:00 – 12:00');

    // Active by default; toggling deactivates it (and persists)
    const toggle = row.getByRole('switch');
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    const afterToggle = await api<any[]>(await ownerToken(), 'GET', `/api/lots/${LOT}/availability`);
    expect(afterToggle.body.find((w) => w.specific_date === date)?.is_active).toBe(false);

    // Delete
    await row.getByRole('button').click();
    await expect(toast(page).filter({ hasText: 'Availability window removed' })).toBeVisible({ timeout: 8000 });
    await expect(rowWith(page, uiDate(date))).toHaveCount(0);
  });

  test('an added window persists after a reload', async ({ page }) => {
    const dialog = await addOneTimeWindow(page, '14:00', '16:00');
    await dialog.getByRole('button', { name: 'Add Window' }).click();
    await expect(rowWith(page, uiDate(date))).toBeVisible({ timeout: 8000 });

    await page.reload();
    await waitForNav(page);
    await page.getByRole('tab', { name: new RegExp(LOT) }).click();
    await expect(rowWith(page, uiDate(date))).toContainText('14:00 – 16:00');
  });
});
