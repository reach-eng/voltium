import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Admin Finance & Transactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to Finance section', async ({ page }) => {
    await page.click('button[data-nav-id="transactions"]');
    await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();
  });
});
