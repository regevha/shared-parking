import { Page, Locator } from '@playwright/test';

/**
 * Data rows of an Ant Design table.
 *
 * `.ant-table-tbody tr` also matches antd's hidden `tr.ant-table-measure-row` (used for column-width
 * measurement when `scroll.x` is set), which is never visible — assertions on `:first` row fail even
 * when the table is full. `tr.ant-table-row` is only ever a real data row.
 */
export const tableRows = (page: Page): Locator => page.locator('tr.ant-table-row');

/** A data row containing the given text. */
export const rowWith = (page: Page, text: string | RegExp): Locator =>
  page.locator('tr.ant-table-row', { hasText: text });

/** The confirmation dialog opened by `Modal.confirm(...)`. */
export const confirmDialog = (page: Page): Locator => page.locator('.ant-modal-confirm');

/**
 * Open an Ant Design <Select> and pick the option whose text is exactly `optionText`.
 *
 * antd virtualizes long option lists (only the first ~8 of 24 start times are in the DOM), so the
 * dropdown is scrolled until the option has been rendered.
 */
export async function pickOption(page: Page, trigger: Locator, optionText: string): Promise<void> {
  await trigger.click();
  // `.last()`: the previously used dropdown may still be playing its leave animation (antd portals
  // are appended in the order they were opened, so the one we just opened is the last one).
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  const exact = new RegExp(`^${optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  const option = dropdown.locator('.ant-select-item-option').filter({ hasText: exact });

  await dropdown.waitFor({ state: 'visible' });
  const holder = dropdown.locator('.rc-virtual-list-holder');
  for (let i = 0; i < 30 && (await option.count()) === 0; i++) {
    await holder.evaluate((el) => el.scrollBy(0, 120));
    await page.waitForTimeout(40);
  }
  await option.first().click();
}

/** Toast shown by antd `notification.*`. */
export const toast = (page: Page): Locator => page.locator('.ant-notification-notice');
