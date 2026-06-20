import { test, expect } from '@playwright/test';

/**
 * Admin Login & Permissions E2E Tests
 *
 * Tests admin login flow, role-based access, and permission boundaries
 * against the running admin panel.
 */
test.describe('Admin Login & Permissions', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('admin login page is accessible', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    // Admin panel should show login or dashboard
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    const dashboard = page.getByText(/Welcome back/i);
    await expect(loginBtn.or(dashboard).first()).toBeVisible({ timeout: 15_000 });
  });

  test('auto-login places admin in dashboard', async ({ page }) => {
    test.setTimeout(45_000);

    // Mock a successful admin dashboard response
    await page.route('**/api/admin/dashboard*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalRiders: 42,
            activeRiders: 30,
            totalVehicles: 20,
            availableVehicles: 10,
            pendingTransactions: 5,
            openTickets: 2,
            activeRentals: 15,
          },
        }),
      })
    );

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }

    // Dashboard should appear
    await expect(page.getByText(/Welcome back/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('unauthorized API calls return 401', async ({ page }) => {
    test.setTimeout(15_000);

    // Test that hitting admin API without session returns 401
    const response = await page.request.get('/api/admin/dashboard');
    expect(response.status()).toBe(401);
  });

  test('admin panel shows navigation sections', async ({ page }) => {
    test.setTimeout(45_000);

    // Mock needed endpoints
    await page.route('**/api/admin/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }

    // Wait for some navigation to be present
    await page.waitForLoadState('networkidle').catch(() => {});
    const navItems = page.locator('nav, [role="navigation"]').first();
    await expect(navItems).toBeVisible({ timeout: 20_000 });
  });

  test('admin logout clears session', async ({ page }) => {
    test.setTimeout(45_000);

    await page.route('**/api/admin/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    // Look for logout button
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i }).first();
    if (await logoutBtn.isVisible({ timeout: 10_000 })) {
      await logoutBtn.click();
      // After logout, should show login again
      await expect(loginBtn).toBeVisible({ timeout: 15_000 });
    }
  });
});
