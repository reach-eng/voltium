import { test, expect } from '@playwright/test';

/**
 * Pickup Flow Admin E2E Tests
 */
test.describe('Pickup Workflow Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('rentals API requires admin auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/rentals');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view active rentals', async ({ page }) => {
    test.setTimeout(45_000);

    await page.route('**/api/admin/rentals*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'rental-1',
              status: 'ACTIVE',
              rider: { fullName: 'Ravi Gupta', riderId: 'VF-040' },
              vehicle: { vehicleId: 'VEH-001', plateNumber: 'KA01XY0001' },
              hub: { name: 'Koramangala Hub' },
              startedAt: new Date().toISOString(),
            },
          ],
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
            activeRentals: 1,
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

    const rentalsNav = page.getByText(/rental|fleet/i).first();
    if (await rentalsNav.isVisible({ timeout: 10_000 })) {
      await rentalsNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const entry = page.getByText(/Ravi Gupta|VEH-001|Koramangala/i).first();
    await expect(entry.or(page.locator('[data-testid="rentals-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
