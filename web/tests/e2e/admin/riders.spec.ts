import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Admin Riders Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to Riders section', async ({ page }) => {
    await page.click('button[data-nav-id="riders"]');
    await expect(page.getByRole('heading', { name: 'Riders' })).toBeVisible();
  });
});
