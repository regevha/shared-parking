import { test, expect, Page } from '@playwright/test';
import { loginAs, waitForNav } from '../fixtures/auth';
import {
  Account, api, createAccount, createPendingRequest, deleteAccount, futureDate, managerToken, uiDate,
} from '../fixtures/api';

/** Parking Status board: the lot grid, lot detail dialog, time travel and occupancy. */
test.describe('Parking Status board', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAs(page, request, 'user');
    await page.goto('/lot-status');
    await waitForNav(page);
  });

  const spot = (page: Page, lotId: string) => page.locator('.parking-spot', { has: page.locator('.lot-id', { hasText: lotId }) });

  test('renders every seeded lot as a focusable, labelled button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Parking Status' })).toBeVisible();
    await expect(page.locator('.parking-spot').first()).toBeVisible({ timeout: 8000 });
    expect(await page.locator('.parking-spot').count()).toBeGreaterThanOrEqual(10);

    const lot = spot(page, 'LOT-101-A');
    await expect(lot).toHaveAttribute('role', 'button');
    await expect(lot).toHaveAttribute('tabindex', '0');
    await expect(lot).toHaveAttribute('aria-label', /^LOT-101-A: /);
  });

  test('summary stats and legend are shown', async ({ page }) => {
    await expect(page.locator('.parking-spot').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Status Legend')).toBeVisible();
    for (const label of ['Occupied', 'Available', 'Blocked']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('clicking a lot opens its details with the owner; Escape closes it', async ({ page }) => {
    await spot(page, 'LOT-101-A').click();
    const dialog = page.locator('.ant-modal', { hasText: 'LOT-101-A' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Sarah');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('a lot can be opened from the keyboard', async ({ page }) => {
    const lot = spot(page, 'LOT-102');
    await lot.focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator('.ant-modal', { hasText: 'LOT-102' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Mike');
  });

  test('the "Now" button is available and keeps the live info text', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Now' })).toBeVisible();
    await expect(page.getByText('Displays the current status of all parking lots')).toBeVisible();
  });

  test.describe('occupancy at a chosen time', () => {
    let requester: Account;
    let requestId: string;
    let date: string;

    test.beforeEach(async () => {
      requester = await createAccount('occupant');
      // A booking far in the future (so cleanup is always allowed), on a lot nobody else books.
      date = futureDate(120);
      ({ id: requestId } = await createPendingRequest(requester.token, { date, startTime: '09:00', endTime: '11:00', duration: 2 }));
      const res = await api(await managerToken(), 'PATCH', `/api/requests/${requestId}/approve`, {
        lot_id: 'LOT-302', floor: 'Floor 3', lot_owner: 'Mike',
      });
      expect(res.status).toBe(200);
    });

    test.afterEach(async () => {
      // Managers may cancel approved bookings regardless of the cancellation window
      await api(await managerToken(), 'DELETE', `/api/requests/${requestId}`);
      await deleteAccount(requester);
    });

    test('lot shows as occupied by the requester during the booked time, free outside it', async ({ page }) => {
      // The outer beforeEach loaded the board before this booking existed — reload to pick it up.
      await page.reload();
      await waitForNav(page);
      const picker = page.locator('.ant-picker input').first();

      // During the booking
      await picker.click();
      await picker.fill(`${uiDate(date)} 09:30`);
      await page.keyboard.press('Enter');
      await expect(spot(page, 'LOT-302')).toHaveAttribute('aria-label', 'LOT-302: occupied', { timeout: 8000 });

      await spot(page, 'LOT-302').click();
      const dialog = page.locator('.ant-modal', { hasText: 'LOT-302' });
      await expect(dialog).toContainText(requester.name);
      await expect(dialog).toContainText(requestId);
      await page.keyboard.press('Escape');

      // After the booking has ended
      await picker.click();
      await picker.fill(`${uiDate(date)} 12:00`);
      await page.keyboard.press('Enter');
      await expect(spot(page, 'LOT-302')).not.toHaveAttribute('aria-label', 'LOT-302: occupied', { timeout: 8000 });
    });
  });
});
