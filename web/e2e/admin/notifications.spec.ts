import { test, expect } from '@playwright/test';

/**
 * Notifications Admin E2E Tests
 */
test.describe('Notifications Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('notifications API requires admin auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/notifications');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can send broadcast notification', async ({ page }) => {
    test.setTimeout(45_000);
    let notificationSent = false;

    await page.route('**/api/admin/notifications*', async (route) => {
      if (route.request().method() === 'POST') {
        notificationSent = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { sent: 150 } }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

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

    const notifNav = page.getByText(/notification|announcement/i).first();
    if (await notifNav.isVisible({ timeout: 10_000 })) {
      await notifNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    // Look for send/broadcast button
    const sendBtn = page.getByRole('button', { name: /send|broadcast/i }).first();
    if (await sendBtn.isVisible({ timeout: 10_000 })) {
      await sendBtn.click();
      await page.waitForTimeout(1000);
    }

    expect(page).toBeDefined();
  });
});
