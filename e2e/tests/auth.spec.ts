import { test, expect } from '@playwright/test';
import { loginAs, loginViaUI, waitForNav, CREDENTIALS } from '../fixtures/auth';

test.describe('Authentication', () => {
  test('login with valid user credentials shows correct nav items', async ({ page }) => {
    await loginViaUI(page, CREDENTIALS.user.email, CREDENTIALS.user.password);
    await waitForNav(page);
    await expect(page.getByRole('menuitem', { name: 'My Requests' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Admin Panel' })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'My Lots' })).not.toBeVisible();
  });

  test('login with valid manager credentials shows Admin Panel', async ({ page }) => {
    await loginViaUI(page, CREDENTIALS.manager.email, CREDENTIALS.manager.password);
    await waitForNav(page);
    await expect(page.getByRole('menuitem', { name: 'Admin Panel' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'My Requests' })).not.toBeVisible();
  });

  test('login with wrong password shows error alert', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill(CREDENTIALS.user.email);
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Ant Design notification or inline error should appear
    await expect(page.locator('.ant-form-item-explain-error, .ant-alert, [role="alert"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('logout clears session and returns to login page', async ({ page, request }) => {
    await loginAs(page, request, 'user');
    await page.goto('/my-requests');
    await waitForNav(page);

    // Open user dropdown and click Sign out
    await page.getByText('Sign out').click({ force: true }).catch(async () => {
      // On some layouts Sign out is inside a dropdown — click the avatar/name first
      await page.locator('.ant-dropdown-trigger').last().click();
      await page.getByText('Sign out').click();
    });

    // Login form should appear
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 8000 });

    // Token removed from localStorage
    const token = await page.evaluate(() => localStorage.getItem('parking_token'));
    expect(token).toBeNull();
  });

  test('unauthenticated visit to protected route shows login page', async ({ page }) => {
    await page.goto('/my-requests');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 8000 });
  });
});
