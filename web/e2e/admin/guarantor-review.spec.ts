import { test, expect } from '@playwright/test';

/**
 * Guarantor Review Admin E2E Tests
 */
test.describe('Guarantor Review Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('guarantors API requires admin auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/guarantors');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view guarantor submissions', async ({ page }) => {
    test.setTimeout(45_000);

    await page.route('**/api/admin/guarantors*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'guar-1',
              riderId: 'rider-1',
              rider: { fullName: 'Vikram Patel', riderId: 'VF-020' },
              guarantorName: 'Ramesh Patel',
              guarantorPhone: '9123456789',
              relationship: 'FATHER',
              status: 'SUBMITTED',
              submittedAt: new Date().toISOString(),
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

    const guarantorNav = page.getByText(/guarantor/i).first();
    if (await guarantorNav.isVisible({ timeout: 10_000 })) {
      await guarantorNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const entry = page.getByText(/Vikram Patel|Ramesh Patel/i).first();
    await expect(entry.or(page.locator('[data-testid="guarantor-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
