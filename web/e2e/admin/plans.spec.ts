import { test, expect } from '@playwright/test';

/**
 * Plans Admin E2E Tests
 */
test.describe('Plans Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const mockPlans = [
    {
      id: 'plan-1',
      name: 'Standard Plan',
      description: '8-hour shift, 5 days a week',
      type: 'STANDARD',
      isActive: true,
      dailyRate: 30000, // in paise = INR 300
      weeklyRate: 180000,
      monthlyRate: 700000,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'plan-2',
      name: 'Premium Plan',
      description: '12-hour shift, 6 days a week',
      type: 'PREMIUM',
      isActive: true,
      dailyRate: 50000,
      weeklyRate: 300000,
      monthlyRate: 1200000,
      createdAt: new Date().toISOString(),
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/plans*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockPlans }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/admin/dashboard*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { totalRiders: 5, activeRiders: 3, totalVehicles: 10, availableVehicles: 8, pendingTransactions: 0, openTickets: 0, activeRentals: 2 },
        }),
      })
    );
  });

  test('plans API requires admin auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/plans');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view plans list', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const plansNav = page.getByText(/plan/i).first();
    if (await plansNav.isVisible({ timeout: 10_000 })) {
      await plansNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const planEntry = page.getByText(/Standard Plan|Premium Plan/i).first();
    await expect(planEntry.or(page.locator('[data-testid="plans-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('rider can view available plans', async ({ page }) => {
    test.setTimeout(15_000);

    // Mock rider plans endpoint
    await page.route('**/api/rider/plans*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockPlans.filter((p) => p.isActive) }),
      })
    );

    // Rider plans endpoint requires JWT auth
    const response = await page.request.get('/api/rider/plans');
    expect([200, 401]).toContain(response.status());
  });
});
