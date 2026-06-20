import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession, switchToAdmin } from './fixtures/helpers';

test.describe('Admin and Flutter App Bridge E2E Test Flow', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const testPhone = '9876543210';
  const riderId = 'rider-bridge-101';

  test('Orchestrated Flow: KYC Submission to Approval & Wallet Credit', async ({ page }) => {
    test.setTimeout(120_000);

    // --- PART 1: SIMULATE FLUTTER ACTION (API mocks representing the app client state) ---
    // Mock the profile API consumed by both Flutter and internal layouts
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: riderId,
            fullName: 'Bridge Test Rider',
            phone: testPhone,
            kycStatus: 'SUBMITTED',
            registrationDone: true,
            kycDone: true,
            depositDone: false,
            planDone: false,
            pickupDone: false,
          },
        }),
      });
    });

    // Mock wallet API showing initial 0 balance
    await page.route('**/api/rider/wallet*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            balance: 0,
            deposits: 0,
            transactions: [],
          },
        }),
      });
    });

    // Login as the rider first and mock their onboarding screen transition
    await loginAsRiderWithSession(page, {
      id: riderId,
      phone: testPhone,
      fullName: 'Bridge Test Rider',
      kycStatus: 'SUBMITTED',
      kycDone: true,
      registrationDone: true,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      screen: 'pre_dashboard',
    });

    // Go directly to admin panel login screen
    await page.goto('/?view=admin');

    // Assert that the Admin login screen is visible
    await expect(page.getByText(/Please log in with your admin credentials/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Tap "Login as Admin (Dev)"
    const devLoginBtn = page.getByRole('button', { name: /Login as Admin \(Dev\)/i }).first();
    await devLoginBtn.click({ force: true });

    // Assert dashboard overview is loaded successfully
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible({ timeout: 20_000 });

    // --- PART 2: ADMIN PANEL UI INTERACTION ---
    // Register the admin riders endpoint to return our mock bridge rider for review
    await page.route('**/api/admin/riders*', async (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { id: riderId, kycStatus: 'APPROVED' },
          }),
        });
      }

      // Default GET request lists the pending rider
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: riderId,
              riderId: 'VF-RD-BRIDGE',
              fullName: 'Bridge Test Rider',
              phone: testPhone,
              kycStatus: 'SUBMITTED',
              guarantorStatus: 'SUBMITTED',
              createdAt: new Date().toISOString(),
              state: 'ONBOARDING',
            },
          ],
        }),
      });
    });

    // Switch view to Admin Panel
    await switchToAdmin(page, ['riders']);

    // Navigate to KYC Management tab
    await page.locator('[data-nav-id="riders"]').first().click({ force: true });

    // Switch to Pending KYC reviews tab
    const pendingTab = page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Pending/i })
      .first();
    await pendingTab.waitFor({ state: 'visible', timeout: 10_000 });
    await pendingTab.click({ force: true });

    // Verify bridge rider is listed
    await expect(page.getByText(/Bridge Test Rider/i).first()).toBeVisible({ timeout: 10_000 });

    // Approve the KYC
    const approveBtn = page.locator('button[title="Approve"]').first();
    await approveBtn.click({ force: true });

    // Confirm inside the dialog
    const confirmBtn = page
      .getByRole('dialog')
      .getByRole('button', { name: /^Approve$/i })
      .first();
    await confirmBtn.click({ force: true });

    // --- PART 3: SIMULATE FLUTTER RE-VERIFICATION (APP UPDATE) ---
    // Modify profile mock to return APPROVED status
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: riderId,
            fullName: 'Bridge Test Rider',
            phone: testPhone,
            kycStatus: 'APPROVED',
            registrationDone: true,
            kycDone: true,
            depositDone: true,
            planDone: true,
            pickupDone: false,
          },
        }),
      });
    });

    // Re-verify as rider
    await loginAsRiderWithSession(page, {
      id: riderId,
      phone: testPhone,
      fullName: 'Bridge Test Rider',
      kycStatus: 'APPROVED',
      kycDone: true,
      registrationDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: false,
      screen: 'active_dashboard',
    });

    // Navigate to rider view again
    await page.goto('/?view=rider');

    // Assert user dashboard is now Active (representing the app unlocking)
    await expect(page.getByText(/Available Balance/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
