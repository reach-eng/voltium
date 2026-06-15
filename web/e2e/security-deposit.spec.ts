import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession, switchToAdmin } from './fixtures/helpers';

test.describe('Security Deposit Flow', () => {
  const phone = '9876543210';

  test('initiate security deposit from top-up menu', async ({ page }) => {
    test.setTimeout(150_000);

    // API Mocks
    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-rider',
            fullName: 'Alex Rider',
            kycStatus: 'APPROVED',
            kycDone: true,
            registrationDone: true,
            depositDone: false,
            walletBalance: 0,
          },
        }),
      })
    );
    await page.route('**/api/rider/dashboard*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            rider: { id: 'test-rider', fullName: 'Alex Rider', walletBalance: 0 },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 0,
            referralCode: 'ALEX1',
          },
        }),
      })
    );

    // Session injection → pre_dashboard (deposit required)
    await loginAsRiderWithSession(page, {
      id: 'test-rider',
      phone,
      fullName: 'Alex Rider',
      kycStatus: 'APPROVED',
      kycDone: true,
      registrationDone: true,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      walletBalance: 0,
      screen: 'pre_dashboard',
    });

    // Land on pre-dashboard
    await expect(
      page.getByText(/Available Balance|Ready to Ride|Book Vehicle/i).first()
    ).toBeVisible({ timeout: 20_000 });

    // Click Top Up
    await page.getByText('Top Up', { exact: true }).first().click({ force: true });

    // 3. Purpose Selection
    await expect(page.getByText(/Select Purpose/i).first()).toBeVisible({ timeout: 15_000 });

    // Locate Security Deposit card
    const securityDepositCard = page
      .locator('div')
      .filter({ hasText: /Security Deposit/ })
      .filter({ hasText: /₹2,000/ })
      .first();
    await securityDepositCard.click({ force: true });

    await page
      .locator('button')
      .filter({ hasText: /Continue to Payment/i })
      .first()
      .click({ force: true });

    // 4. Amount Verification
    await expect(page.getByText(/Enter Amount/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Amount to Pay/i).first()).toBeVisible();
    await expect(page.getByText(/₹2,000/).last()).toBeVisible();

    // 5. Proceed to UPI
    await page
      .locator('button')
      .filter({ hasText: /Proceed to UPI/i })
      .first()
      .click({ force: true });

    // 6. UPI Screen
    await expect(page.getByText(/Top Up/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
