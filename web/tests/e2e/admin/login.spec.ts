import { test, expect } from '@playwright/test';

test.describe('Admin Login', () => {
  test('should login using dev auto-login and see dashboard', async ({ page }) => {
    await page.goto('/?view=admin');

    // Wait for auth check to complete and show login options
    const loginButton = page.getByRole('button', { name: /Login as Admin \(Dev\)/i });
    await expect(loginButton).toBeVisible();

    // Click auto login
    await loginButton.click();

    // Verify redirect/reload to Dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });
});
