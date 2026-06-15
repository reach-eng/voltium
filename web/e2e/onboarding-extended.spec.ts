import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession } from './fixtures/helpers';

/**
 * Phase 1 Extended: Legal Consent & Onboarding Resume
 * Uses session injection for reliability — no OTP flow needed.
 */
test.describe('Onboarding Extended (Phase 1B)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null }),
      });
    });
    await page.route('**/api/rider/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: { id: 'r1', fullName: 'Resume Tester', walletBalance: 0 },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 0,
          },
        }),
      });
    });
  });

  test('Legal Consent Screen — Expand, Accept & Continue', async ({ page }) => {
    // Inject minimal session — app will land on whatever the initial screen is
    await loginAsRiderWithSession(page, {
      id: 'r1',
      fullName: 'Resume Tester',
      walletBalance: 0,
      kycStatus: 'NONE',
      registrationDone: false,
      kycDone: false,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      legalAccepted: false,
      screen: 'legal',
    });

    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 15_000,
    });
    await page.evaluate(() => {
      if ((window as any).queryClient) (window as any).queryClient?.clear?.();
      (window as any).useAppStore.getState().setScreen('legal');
    });

    await expect(page.getByText(/Agree to Terms/i).first()).toBeVisible({ timeout: 15_000 });

    // Expand Terms of Service
    await page.getByText('Terms of Service').first().click();
    await expect(page.getByText(/Account Registration/i).first()).toBeVisible({ timeout: 5_000 });

    // Expand Privacy Policy
    await page.getByText('Privacy Policy').first().click();
    await expect(page.getByText(/Information We Collect/i).first()).toBeVisible({ timeout: 5_000 });

    // Continue button should be disabled before accepting
    const continueBtn = page.getByRole('button', { name: /Continue/i }).first();
    await expect(continueBtn).toBeDisabled();

    // Accept terms
    await page
      .getByText(/I have read and agree/i)
      .first()
      .click();

    // Continue should now be enabled
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // Should navigate to Intent screen
    await expect(page.getByText(/How will you use/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Onboarding Resume — Re-login resumes from last step', async ({ page }) => {
    // Mock partial profile (KYC done, deposit not done)
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'resume_rider',
            fullName: 'Resume Tester',
            registrationDone: true,
            kycDone: true,
            depositDone: false,
            planDone: false,
            pickupDone: false,
            walletBalance: 0,
            securityDeposit: 0,
            kycStatus: 'APPROVED',
            accountStatus: 'ACTIVE',
          },
        }),
      });
    });

    await loginAsRiderWithSession(page, {
      id: 'resume_rider',
      fullName: 'Resume Tester',
      walletBalance: 0,
      kycStatus: 'APPROVED',
      registrationDone: true,
      kycDone: true,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      screen: 'pre_dashboard',
    });

    // Should land on pre-dashboard (deposit step)
    await expect(
      page.getByText(/Available Balance|Security Deposit|Book Vehicle|Ready to Ride/i).first()
    ).toBeVisible({ timeout: 25_000 });
  });
});
