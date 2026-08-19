import { expect, type Page } from '@playwright/test';

/**
 * Log into the admin panel through the real login form.
 *
 * P0-2: the dev auto-login button is gone, so e2e specs authenticate with
 * the same credentials the seeders create (ADMIN_PASSWORD for
 * admin@voltium.io via db:seed-dev-admin, or TEST_ADMIN_* overrides).
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/?view=admin');

  const email = process.env.TEST_ADMIN_EMAIL || 'admin@voltium.io';
  const password =
    process.env.TEST_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';

  if (!password) {
    throw new Error(
      'e2e admin login requires ADMIN_PASSWORD (or TEST_ADMIN_PASSWORD / SEED_ADMIN_PASSWORD) to be set'
    );
  }

  await page.fill('#admin-email', email);
  await page.fill('#admin-password', password);
  await page.getByRole('button', { name: /Sign In as Admin/i }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
}
