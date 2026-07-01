import { test, expect } from '@playwright/test';

test.describe('Admin Riders Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin \(Dev\)/i });
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    }
  });

  test('should navigate to Riders section', async ({ page }) => {
    await page.click('button[data-nav-id="riders"]');
    await expect(page.getByRole('heading', { name: 'Riders' })).toBeVisible();
  });
});
