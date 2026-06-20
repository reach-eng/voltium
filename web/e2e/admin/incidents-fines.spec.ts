import { test, expect } from '@playwright/test';

/**
 * Incidents & Fines Admin E2E Tests
 */
test.describe('Incidents & Fines Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('incidents API requires admin auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/incidents');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view incidents list', async ({ page }) => {
    test.setTimeout(45_000);

    await page.route('**/api/admin/incidents*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'inc-1',
              type: 'DAMAGE',
              description: 'Scratch on front fender',
              severity: 'MINOR',
              fineAmount: 50000,
              status: 'OPEN',
              rider: { fullName: 'Rajesh Kumar', riderId: 'VF-030' },
              vehicle: { vehicleId: 'VEH-001', plateNumber: 'KA01XY9999' },
              createdAt: new Date().toISOString(),
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

    const incidentNav = page.getByText(/incident|fine/i).first();
    if (await incidentNav.isVisible({ timeout: 10_000 })) {
      await incidentNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const entry = page.getByText(/Rajesh Kumar|DAMAGE|Scratch/i).first();
    await expect(entry.or(page.locator('[data-testid="incidents-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
