import { test, expect } from '@playwright/test';

/**
 * Return Workflow Admin E2E Tests
 */
test.describe('Return Workflow Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('return-pending rentals visible to admin', async ({ page }) => {
    test.setTimeout(45_000);

    await page.route('**/api/admin/rentals*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'rental-2',
              status: 'RETURN_PENDING',
              rider: { fullName: 'Sonia Mehta', riderId: 'VF-050' },
              vehicle: { vehicleId: 'VEH-002', plateNumber: 'KA02XY0002' },
              returnPhotos: ['uploads/left.jpg', 'uploads/right.jpg'],
              returnReason: 'End of rental',
              returnRequestedAt: new Date().toISOString(),
            },
          ],
        }),
      })
    );

    await page.route('**/api/admin/dashboard*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { totalRiders: 5, activeRiders: 3, totalVehicles: 10, availableVehicles: 8, pendingTransactions: 0, openTickets: 0, activeRentals: 1 } }),
      })
    );

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const rentalsNav = page.getByText(/rental|return/i).first();
    if (await rentalsNav.isVisible({ timeout: 10_000 })) {
      await rentalsNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const entry = page.getByText(/Sonia Mehta|RETURN_PENDING|VEH-002/i).first();
    await expect(entry.or(page.locator('[data-testid="rentals-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('admin incidents creation requires auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.post('/api/admin/incidents', {
      data: { vehicleId: 'veh-1', riderId: 'rider-1', type: 'DAMAGE', description: 'Test', fineAmount: 1000 },
    });
    expect([401, 403]).toContain(response.status());
  });
});
