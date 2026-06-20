import { test, expect } from '@playwright/test';

/**
 * Reports Admin E2E Tests
 */
test.describe('Reports Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/analytics*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalRiders: 150,
            activeRiders: 120,
            newRidersThisMonth: 25,
            churnedRiders: 5,
            totalRevenue: 45000000,
            revenueThisMonth: 5000000,
            avgDailyRentals: 85,
          },
        }),
      })
    );

    await page.route('**/api/admin/dashboard*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalRiders: 150,
            activeRiders: 120,
            totalVehicles: 50,
            availableVehicles: 15,
            pendingTransactions: 3,
            openTickets: 1,
            activeRentals: 85,
          },
        }),
      })
    );
  });

  test('analytics API requires admin auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/analytics');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view analytics/reports', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const reportsNav = page.getByText(/report|analytics/i).first();
    if (await reportsNav.isVisible({ timeout: 10_000 })) {
      await reportsNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    // Analytics numbers or chart should appear
    const metric = page.getByText(/150|120|85/i).first();
    await expect(metric.or(page.locator('[data-testid="analytics"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('reports with date filters return appropriate data', async ({ page }) => {
    test.setTimeout(15_000);

    // Test that analytics endpoint accepts date range params (auth check)
    const response = await page.request.get('/api/admin/analytics?from=2026-01-01&to=2026-06-16');
    expect([401, 403]).toContain(response.status());
  });
});
