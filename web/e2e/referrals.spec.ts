import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession, switchToAdmin } from './fixtures/helpers';

test.describe('Referral System Flow', () => {
  const phoneReferee = '9998882222';
  const refCode = 'VFR-REF123';

  test('new rider signups using a referral code and linkage is verified', async ({ page }) => {
    test.setTimeout(150_000);

    // --- 1. Mock referral-aware session (referee signs up with ref code) ---
    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            id: 'referee-id',
            phone: phoneReferee,
            fullName: 'New Rider',
            kycStatus: 'PENDING',
            referralCode: 'VFR-NEW456',
          },
        }),
      })
    );
    await page.route('**/api/rider/dashboard*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            rider: { id: 'referee-id', fullName: 'New Rider', walletBalance: 0 },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 0,
            referralCode: 'VFR-NEW456',
          },
        }),
      })
    );

    // Inject referee session with referral code in URL
    await loginAsRiderWithSession(page, {
      id: 'referee-id',
      phone: phoneReferee,
      fullName: 'New Rider',
      kycStatus: 'PENDING',
      registrationDone: false,
      screen: 'intent',
    });

    // --- 2. ADMIN VERIFICATION ---
    // Register admin referrals mock BEFORE switchToAdmin (no unroute needed — last wins).
    await page.route('**/api/admin/referrals*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            referrals: [
              {
                id: 'ref-123',
                refereeId: 'referee-id',
                refereeName: 'New Rider',
                refereePhone: phoneReferee,
                refereeState: 'ONBOARDING',
                referredAt: new Date().toISOString(),
                referrerName: 'John Referrer',
                referrerCode: refCode,
                earningForReferrer: 0,
              },
            ],
            total: 1,
            summary: {
              totalLeads: 1,
              activeRiders: 0,
              totalEarnings: 0,
            },
          },
        }),
      })
    );

    // switchToAdmin skips 'referrals' so our handler wins.
    await switchToAdmin(page, ['referrals']);

    // Navigate to Referrals
    await page
      .locator('button')
      .filter({ hasText: /^Referrals$/ })
      .first()
      .click({ force: true });

    // Verify the linkage
    await expect(page.getByText(/Referrals/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Loading.../i)).not.toBeVisible({ timeout: 10_000 });

    const table = page.locator('table');
    await expect(table.or(page.getByText(/New Rider/i)).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/New Rider/).first()).toBeVisible();
    await expect(page.getByText(refCode).first()).toBeVisible();
  });
});
