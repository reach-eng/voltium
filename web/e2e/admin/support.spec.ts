import { test, expect } from '@playwright/test';

/**
 * Support Tickets Admin E2E Tests
 */
test.describe('Support Tickets Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const mockTickets = [
    {
      id: 'ticket-1',
      ticketId: 'TKT-001',
      subject: 'Vehicle breakdown on highway',
      category: 'BREAKDOWN',
      status: 'OPEN',
      priority: 'HIGH',
      createdAt: new Date().toISOString(),
      rider: { fullName: 'Amit Kumar', riderId: 'VF-010' },
    },
    {
      id: 'ticket-2',
      ticketId: 'TKT-002',
      subject: 'Payment not credited',
      category: 'PAYMENT',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      createdAt: new Date().toISOString(),
      rider: { fullName: 'Sunita Devi', riderId: 'VF-011' },
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/tickets*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockTickets, total: 2 }),
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
          data: { totalRiders: 5, activeRiders: 3, totalVehicles: 10, availableVehicles: 8, pendingTransactions: 0, openTickets: 2, activeRentals: 2 },
        }),
      })
    );
  });

  test('support tickets API requires auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/tickets');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view support tickets', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const supportNav = page.getByText(/support|ticket/i).first();
    if (await supportNav.isVisible({ timeout: 10_000 })) {
      await supportNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const ticketEntry = page.getByText(/Vehicle breakdown|TKT-001|Amit Kumar/i).first();
    await expect(ticketEntry.or(page.locator('[data-testid="tickets-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('ticket reply API requires auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.post('/api/admin/tickets/ticket-1/messages', {
      data: { message: 'We are looking into this.' },
    });
    expect([401, 403]).toContain(response.status());
  });
});
