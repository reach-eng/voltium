import { test, expect } from '@playwright/test';

test.describe('Admin Login Workflow E2E Test', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Should navigate to Admin view and allow Auto-Login in Dev mode', async ({ page }) => {
    test.setTimeout(60_000);

    // Mock global configuration check
    await page.route('**/api/admin/settings/maintenance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { maintenanceMode: false, autoApproveKyc: false },
        }),
      });
    });

    // Mock Admin Auth Check (Initially Unauthorized to show login page)
    await page.route('**/api/admin/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Unauthorized' },
        }),
      });
    });

    // Mock Auto-Login endpoint to simulate success
    await page.route('**/api/admin/auth/auto-login', async (route) => {
      // Set auth me route to succeed on reload
      await page.route('**/api/admin/auth/me', async (r2) => {
        await r2.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { role: 'SUPER_ADMIN', email: 'admin@voltium.io', name: 'Dev Admin' },
          }),
        });
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'admin-dev-id', role: 'SUPER_ADMIN', email: 'admin@voltium.io' },
        }),
      });
    });

    // Mock Dashboard stats mapping
    await page.route('**/api/admin/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalRiders: 10,
            activeRentals: 2,
            totalVehicles: 15,
            availableVehicles: 8,
            totalBalance: 5000,
            totalDeposits: 80000,
            pendingTransactions: 0,
            openTickets: 0,
          },
        }),
      });
    });

    // Go directly to admin panel login screen
    await page.goto('/?view=admin');

    // Assert that the Admin login screen is visible
    await expect(page.getByText(/Please log in with your admin credentials/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // Tap "Login as Admin (Dev)" button
    const devLoginBtn = page.getByRole('button', { name: /Login as Admin/i }).first();
    await devLoginBtn.click({ force: true });

    // Assert dashboard overview loads successfully (confirms login action redirect succeeded)
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
