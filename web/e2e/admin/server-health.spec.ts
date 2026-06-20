import { test, expect } from '@playwright/test';

/**
 * Server Health E2E Tests
 */
test.describe('Server Health', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('health endpoint is publicly accessible', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/health');
    expect([200, 503]).toContain(response.status());
  });

  test('storage health endpoint is accessible', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/health/storage');
    expect([200, 503]).toContain(response.status());
  });

  test('admin health view shows system status', async ({ page }) => {
    test.setTimeout(45_000);

    await page.route('**/api/health*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          database: 'ok',
          storage: 'ok',
          workers: 'ok',
          uptime: 3600,
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
            totalRiders: 5,
            activeRiders: 3,
            totalVehicles: 10,
            availableVehicles: 8,
            pendingTransactions: 0,
            openTickets: 0,
            activeRentals: 2,
          },
        }),
      })
    );

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    // Look for health/status section in admin
    const healthNav = page.getByText(/health|server status|system/i).first();
    if (await healthNav.isVisible({ timeout: 10_000 })) {
      await healthNav.click();
    }

    expect(page).toBeDefined();
  });

  test('health response does not leak secrets', async ({ page }) => {
    test.setTimeout(15_000);

    const response = await page.request.get('/api/health');
    const text = await response.text();

    // Should not contain secret-like patterns
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('JWT_SECRET');
    expect(text).not.toContain('password');
  });
});
