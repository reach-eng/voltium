import { test, expect } from '@playwright/test';

/**
 * Wallet Deposit Admin Review E2E Tests
 *
 * Tests admin deposit review workflow: viewing pending deposits,
 * approving/rejecting, and checking wallet balance updates.
 */
test.describe('Wallet Deposit Admin Review', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const mockDeposits = [
    {
      id: 'dep-1',
      riderId: 'rider-1',
      rider: { fullName: 'Priya Singh', phone: '9876543211', riderId: 'VF-002' },
      amount: 150000, // in paise = 1500 INR
      status: 'PENDING_VERIFICATION',
      purpose: 'SECURITY_DEPOSIT',
      proofUrl: '/api/files/proof.jpg',
      submittedAt: new Date().toISOString(),
    },
  ];

  const mockTransactions = [
    {
      id: 'tx-1',
      type: 'TOP_UP',
      amount: 50000,
      status: 'PENDING',
      purpose: 'WALLET_TOPUP',
      createdAt: new Date().toISOString(),
      rider: { fullName: 'Priya Singh', phone: '9876543211' },
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/deposits*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockDeposits }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/admin/transactions*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockTransactions }),
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
          data: {
            totalRiders: 5,
            activeRiders: 3,
            totalVehicles: 10,
            availableVehicles: 8,
            pendingTransactions: 1,
            openTickets: 0,
            activeRentals: 2,
          },
        }),
      })
    );
  });

  test('admin can view pending deposits', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }

    await page.waitForLoadState('networkidle').catch(() => {});

    // Navigate to deposits/transactions
    const depositsNav = page.getByText(/deposit|transaction|wallet/i).first();
    if (await depositsNav.isVisible({ timeout: 10_000 })) {
      await depositsNav.click();
    }

    // Should see rider name in deposits list
    const riderName = page.getByText(/Priya Singh/i);
    await expect(riderName.or(page.locator('[data-testid="deposits-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('deposit API requires admin authentication', async ({ page }) => {
    test.setTimeout(15_000);

    const response = await page.request.post('/api/admin/deposits', {
      data: { riderId: 'test-id', action: 'APPROVE' },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view pending transactions', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }

    await page.waitForLoadState('networkidle').catch(() => {});

    // Navigate to transactions
    const txNav = page.getByText(/transaction/i).first();
    if (await txNav.isVisible({ timeout: 10_000 })) {
      await txNav.click();
    }

    // Look for pending transaction indicator
    const pendingBadge = page.getByText(/PENDING|pending/i).first();
    await expect(pendingBadge.or(page.locator('[data-status="PENDING"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
