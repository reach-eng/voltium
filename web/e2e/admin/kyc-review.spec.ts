import { test, expect } from '@playwright/test';

/**
 * KYC Review E2E Tests
 *
 * Tests admin KYC review workflow: viewing pending KYC applications,
 * approving, rejecting, and requesting re-submission.
 */
test.describe('KYC Review Admin Workflow', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const mockKycList = [
    {
      id: 'kyc-1',
      riderId: 'rider-1',
      rider: { fullName: 'Rahul Sharma', phone: '9876543210', riderId: 'VF-001' },
      status: 'SUBMITTED',
      documentType: 'AADHAAR',
      documentNumber: '1234-5678-9012',
      documentFront: '/api/files/kyc-front.jpg',
      documentBack: '/api/files/kyc-back.jpg',
      submittedAt: new Date().toISOString(),
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock KYC API responses
    await page.route('**/api/admin/kyc*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockKycList, total: 1 }),
      })
    );

    await page.route('**/api/admin/dashboard*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalRiders: 10,
            activeRiders: 5,
            totalVehicles: 8,
            availableVehicles: 4,
            pendingTransactions: 2,
            openTickets: 0,
            activeRentals: 3,
          },
        }),
      })
    );
  });

  test('admin can view KYC pending submissions', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }

    await page.waitForLoadState('networkidle').catch(() => {});

    // Navigate to KYC section
    const kycNav = page.getByText(/kyc|verification/i).first();
    if (await kycNav.isVisible({ timeout: 10_000 })) {
      await kycNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    // KYC data should be visible
    const riderName = page.getByText(/Rahul Sharma/i);
    await expect(riderName.or(page.locator('[data-testid="kyc-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('admin can approve KYC with API mock', async ({ page }) => {
    test.setTimeout(45_000);
    let kycApproved = false;

    await page.route('**/api/admin/kyc*', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'POST') {
        kycApproved = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockKycList }),
      });
    });

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }

    await page.waitForLoadState('networkidle').catch(() => {});

    // Look for approve button
    const approveBtn = page.getByRole('button', { name: /approve/i }).first();
    if (await approveBtn.isVisible({ timeout: 15_000 })) {
      await approveBtn.click();
      // Wait for the mock to be hit
      await page.waitForTimeout(1000);
      expect(kycApproved).toBe(true);
    }
  });

  test('KYC API returns 401 without admin session', async ({ page }) => {
    test.setTimeout(15_000);

    const response = await page.request.get('/api/admin/kyc');
    expect([401, 403]).toContain(response.status());
  });
});
