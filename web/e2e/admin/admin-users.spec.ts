import { test, expect } from '@playwright/test';

/**
 * Admin Users Management E2E Tests
 */
test.describe('Admin Users Management', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const mockAdmins = [
    {
      id: 'admin-1',
      email: 'superadmin@voltium.app',
      name: 'Superadmin',
      role: 'SUPERADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'admin-2',
      email: 'ops@voltium.app',
      name: 'Operations Admin',
      role: 'ADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  test('admins list API requires auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/admins');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view admin users list', async ({ page }) => {
    test.setTimeout(45_000);

    await page.route('**/api/admin/admins*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockAdmins }),
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
        body: JSON.stringify({ success: true, data: { totalRiders: 5, activeRiders: 3, totalVehicles: 10, availableVehicles: 8, pendingTransactions: 0, openTickets: 0, activeRentals: 2 } }),
      })
    );

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const adminNav = page.getByText(/admin user|team|staff/i).first();
    if (await adminNav.isVisible({ timeout: 10_000 })) {
      await adminNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const entry = page.getByText(/superadmin@voltium.app|ops@voltium.app|Superadmin/i).first();
    await expect(entry.or(page.locator('[data-testid="admins-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('create admin requires SUPERADMIN role', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.post('/api/admin/admins', {
      data: { email: 'newadmin@voltium.app', name: 'New Admin', role: 'ADMIN' },
    });
    expect([401, 403]).toContain(response.status());
  });
});
