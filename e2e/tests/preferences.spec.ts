import { test, expect, Page } from '@playwright/test';
import { waitForNav } from '../fixtures/auth';
import { Account, api, createAccount, deleteAccount, loginWithToken } from '../fixtures/api';

/** Per-user preferences stored in the DB: dark mode and language (incl. RTL layout for Hebrew). */
test.describe('Preferences: theme & language', () => {
  let acc: Account;

  test.beforeEach(async ({ page }) => {
    acc = await createAccount('prefs');
    await loginWithToken(page, acc.token);
    await page.goto('/my-requests');
    await waitForNav(page);
  });

  test.afterEach(async () => deleteAccount(acc));

  const html = (page: Page) => page.locator('html');
  const themeToggle = (page: Page) => page.locator('.ant-layout-header button:has([aria-label="moon"]), .ant-layout-header button:has([aria-label="sun"])');
  const languageButton = (page: Page) => page.locator('.ant-layout-header button:has([aria-label="global"])');
  const preferences = async () => {
    const res = await api(acc.token, 'GET', `/api/users/${acc.id}/preferences`);
    return res.body;
  };

  test('new accounts start in dark mode', async ({ page }) => {
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  });

  test('theme toggle switches the theme, saves it, and survives a reload', async ({ page }) => {
    await themeToggle(page).click();
    await expect(html(page)).toHaveAttribute('data-theme', 'light');
    await expect.poll(async () => (await preferences()).dark_mode).toBe(false);

    await page.reload();
    await waitForNav(page);
    await expect(html(page)).toHaveAttribute('data-theme', 'light');

    await themeToggle(page).click();
    await expect(html(page)).toHaveAttribute('data-theme', 'dark');
    await expect.poll(async () => (await preferences()).dark_mode).toBe(true);
  });

  test('defaults to English, left-to-right', async ({ page }) => {
    await expect(html(page)).toHaveAttribute('lang', 'en');
    await expect(html(page)).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('menuitem', { name: 'My Requests' })).toBeVisible();
  });

  test('switching to Hebrew translates the UI and flips the layout to RTL', async ({ page }) => {
    await languageButton(page).click();
    await page.getByRole('menuitem', { name: 'עברית' }).click();

    await expect(html(page)).toHaveAttribute('lang', 'he');
    await expect(html(page)).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('menuitem', { name: 'הבקשות שלי' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'My Requests' })).toHaveCount(0);
    await expect.poll(async () => (await preferences()).language).toBe('he');
  });

  test('the chosen language is remembered after a reload', async ({ page }) => {
    await languageButton(page).click();
    await page.getByRole('menuitem', { name: 'עברית' }).click();
    await expect.poll(async () => (await preferences()).language).toBe('he');

    await page.reload();
    await waitForNav(page);
    await expect(html(page)).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('menuitem', { name: 'הבקשות שלי' })).toBeVisible();
  });

  test('switching from Hebrew to French restores left-to-right', async ({ page }) => {
    await languageButton(page).click();
    await page.getByRole('menuitem', { name: 'עברית' }).click();
    await expect(html(page)).toHaveAttribute('dir', 'rtl');

    await languageButton(page).click();
    await page.getByRole('menuitem', { name: 'Français' }).click();

    await expect(html(page)).toHaveAttribute('lang', 'fr');
    await expect(html(page)).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('menuitem', { name: 'Mes Demandes' })).toBeVisible();
  });
});
