import { test, expect } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';

test.describe('Role-based navigation — User', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'user');
    await page.goto('/my-requests');
    await waitForNav(page);
  });

  test('sees My Requests, Requests View, Parking Status', async ({ page }) => {
    await expect(page.getByRole('menuitem', { name: 'My Requests' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Requests View' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Parking Status' })).toBeVisible();
  });

  test('does not see My Lots or Admin Panel', async ({ page }) => {
    await expect(page.getByRole('menuitem', { name: 'My Lots' })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Admin Panel' })).not.toBeVisible();
  });
});

test.describe('Role-based navigation — Owner', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'owner');
    await page.goto('/my-lots');
    await waitForNav(page);
  });

  test('sees My Requests, My Lots, Lot Calendar', async ({ page }) => {
    await expect(page.getByRole('menuitem', { name: 'My Requests' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'My Lots' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Lot Calendar' })).toBeVisible();
  });

  test('does not see Admin Panel', async ({ page }) => {
    await expect(page.getByRole('menuitem', { name: 'Admin Panel' })).not.toBeVisible();
  });
});

test.describe('Role-based navigation — Manager', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'manager');
    await page.goto('/admin');
    await waitForNav(page);
  });

  test('sees Admin Panel and Lot Calendar', async ({ page }) => {
    await expect(page.getByRole('menuitem', { name: 'Admin Panel' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Lot Calendar' })).toBeVisible();
  });

  test('does not see My Requests or My Lots', async ({ page }) => {
    await expect(page.getByRole('menuitem', { name: 'My Requests' })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'My Lots' })).not.toBeVisible();
  });
});

test.describe('Direct URL access', () => {
  test('user visiting /admin gets no crash (403 from API, graceful empty state)', async ({ page, request }) => {
    await loginAs(page, request, 'user');
    await page.goto('/admin');
    await waitForNav(page);
    // Page must not show an unhandled error boundary / blank screen
    const body = await page.locator('body').textContent();
    expect(body).not.toBe('');
    // No uncaught JS errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
