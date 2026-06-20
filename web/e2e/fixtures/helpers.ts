import { Page } from '@playwright/test';

/**
 * Standard Admin auto-login routing setup for Playwright tests.
 * Performs real cookie creation or mock authentication depending on configuration.
 */
export async function gotoAdminPanel(page: Page, skipRoutes: string[] = []) {
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

  // Setup Mock Super Admin credentials unless bypassed
  if (!skipRoutes.includes('auth')) {
    await page.route('**/api/admin/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { role: 'SUPER_ADMIN', email: 'admin@voltium.io', name: 'Dev Admin' },
        }),
      });
    });

    await page.route('**/api/admin/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
  }

  // Setup generic Dashboard mock unless bypassed
  if (!skipRoutes.includes('dashboard')) {
    await page.route('**/api/admin/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalRiders: 15,
            activeRentals: 4,
            totalVehicles: 25,
            availableVehicles: 12,
            totalBalance: 8500,
            totalDeposits: 150000,
            pendingTransactions: 1,
            openTickets: 0,
          },
        }),
      });
    });
  }

  // Set auth cookie to bypass login prompts
  await page.context().addCookies([
    {
      name: 'voltium_admin_session',
      value: 'dev-admin-session-token',
      domain: 'localhost',
      path: '/',
    },
  ]);

  // Navigate to admin
  await page.goto('/?view=admin');
}

/**
 * Mock login state helper for Rider
 */
export async function loginAsRiderWithSession(page: Page, riderData: any) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: riderData,
      }),
    });
  });

  await page.context().addCookies([
    {
      name: 'voltium_session',
      value: 'dev-rider-session-token',
      domain: 'localhost',
      path: '/',
    },
  ]);
}

/**
 * Switches the current view from Rider UI to Admin Panel UI
 */
export async function switchToAdmin(page: Page, skipRoutes: string[] = []) {
  await gotoAdminPanel(page, skipRoutes);
}
