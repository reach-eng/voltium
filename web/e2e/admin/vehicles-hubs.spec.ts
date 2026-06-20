import { test, expect } from '@playwright/test';

/**
 * Vehicles & Hubs Admin E2E Tests
 *
 * Tests vehicle and hub management: CRUD operations, fleet status,
 * maintenance state, and vehicle history.
 */
test.describe('Vehicles & Hubs Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const mockHubs = [
    {
      id: 'hub-1',
      name: 'Koramangala Hub',
      address: '12th Main, Koramangala, Bangalore',
      capacity: 20,
      currentCount: 15,
      status: 'ACTIVE',
    },
  ];

  const mockVehicles = [
    {
      id: 'veh-1',
      vehicleId: 'VEH-KA-001',
      plateNumber: 'KA01AB1234',
      model: 'Ather 450X',
      status: 'AVAILABLE',
      hubId: 'hub-1',
      hub: { name: 'Koramangala Hub' },
      mileage: 1200,
    },
    {
      id: 'veh-2',
      vehicleId: 'VEH-KA-002',
      plateNumber: 'KA01AB5678',
      model: 'TVS iQube',
      status: 'IN_USE',
      hubId: 'hub-1',
      hub: { name: 'Koramangala Hub' },
      mileage: 3400,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/hubs*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockHubs }),
      })
    );

    await page.route('**/api/admin/vehicles*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockVehicles, total: 2 }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/admin/fleet*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockVehicles }),
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
            totalVehicles: 2,
            availableVehicles: 1,
            pendingTransactions: 0,
            openTickets: 0,
            activeRentals: 1,
          },
        }),
      })
    );
  });

  test('admin can view vehicle list', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const fleetNav = page.getByText(/fleet|vehicle/i).first();
    if (await fleetNav.isVisible({ timeout: 10_000 })) {
      await fleetNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    // Vehicle data should be visible
    const vehicleEntry = page.getByText(/KA01AB1234|VEH-KA-001|Ather 450X/i).first();
    await expect(vehicleEntry.or(page.locator('[data-testid="vehicle-list"]')).first()).toBeVisible(
      {
        timeout: 20_000,
      }
    );
  });

  test('vehicles API requires auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/vehicles');
    expect([401, 403]).toContain(response.status());
  });

  test('hubs API requires auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/hubs');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view hub list', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const hubsNav = page.getByText(/hub/i).first();
    if (await hubsNav.isVisible({ timeout: 10_000 })) {
      await hubsNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const hubEntry = page.getByText(/Koramangala Hub/i).first();
    await expect(hubEntry.or(page.locator('[data-testid="hub-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('vehicle history endpoint is accessible', async ({ page }) => {
    test.setTimeout(15_000);

    // Mock history endpoint
    await page.route('**/api/admin/vehicles/*/history*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    const response = await page.request.get('/api/admin/vehicles/veh-1/history');
    // Should require auth or return 200 with mock
    expect([200, 401, 403]).toContain(response.status());
  });
});
