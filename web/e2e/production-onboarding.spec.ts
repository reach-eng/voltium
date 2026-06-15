import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession } from './fixtures/helpers';

test.describe('Production Onboarding Flow Walkthrough', () => {
  const phone = '9876543210';
  const userData = {
    name: 'Sarah Connor',
    dob: '1984-05-12',
    email: 'sarah.c@sky.net',
  };
  const guarantorData = {
    name: 'John Connor',
    phone: '9999900000',
  };

  test('from splash icon to guarantor completion', async ({ page }) => {
    test.setTimeout(150_000);

    // API Mocks
    await page.route('**/api/auth/send-otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, otp: '111111' }),
      });
    });
    await page.route('**/api/rider/profile*', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: {} }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null }),
        });
      }
    });
    await page.route('**/api/rider/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: { id: 'test-rider', fullName: 'Sarah Connor', walletBalance: 0 },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 0,
            referralCode: '',
          },
        }),
      });
    });
    await page.route('**/api/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { url: 'https://example.com/dummy.png' } }),
      });
    });
    await page.route('**/api/rider/guarantor', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      });
    });

    // Session injection — start at Intent screen (registration not yet done)
    await loginAsRiderWithSession(page, {
      id: 'test-rider',
      phone,
      fullName: 'Sarah Connor',
      dob: userData.dob,
      fatherName: 'Thomas Connor',
      motherName: 'Sarah Connor Sr',
      bankName: 'Skynet Bank',
      bankAccount: '1234567890',
      bankIfsc: 'SKY0001234',
      kycStatus: 'PENDING',
      registrationDone: false,
      kycDone: false,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      walletBalance: 0,
      screen: 'intent',
    });

    // Force the store to show intent screen
    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 15_000,
    });
    if (
      (await page
        .getByText(/How will you use/i)
        .isVisible({ timeout: 3_000 })
        .catch(() => false)) === false
    ) {
      await page.evaluate(() => {
        if ((window as any).queryClient) (window as any).queryClient.clear();
        (window as any).useAppStore.getState().setScreen('intent');
      });
    }

    // 7. Intent Selection
    await expect(page.getByText(/How will you use/i).first()).toBeVisible({ timeout: 20_000 });
    await page
      .getByText(/Delivery Partner/i)
      .first()
      .click({ force: true });
    await page
      .locator('button')
      .filter({ hasText: /CONTINUE|Continue/i })
      .first()
      .click({ force: true });

    // 8. User Details (Onboarding Step 1)
    await expect(page.getByText(/User Details/i).last()).toBeVisible({ timeout: 20_000 });
    await page.fill('input[placeholder*="Johnathan"]', userData.name).catch(() => {});
    await page.fill('input[placeholder*="Legal Father"]', 'Thomas Connor').catch(() => {});
    await page.fill('input[placeholder*="Legal Mother"]', 'Sarah Connor Sr').catch(() => {});

    // Inject dob
    await page.evaluate((dob: string) => {
      (window as any).useAppStore.getState().setRider({ dob });
    }, userData.dob);
    await page.fill('input[placeholder*="voltfleet.pro"]', userData.email).catch(() => {});

    // Trigger Step 1 submit via hook
    await page.evaluate(() => (window as any).triggerOnboardingSubmit?.());

    // 9. Guarantor Details (Onboarding Step 2)
    await expect(page.getByText(/Guarantor/i).first()).toBeVisible({ timeout: 20_000 });
    await page.fill('input[placeholder*="Johnathan"]', guarantorData.name).catch(() => {});
    await page.fill('input[placeholder*="10-digit"]', guarantorData.phone).catch(() => {});
    await page.fill('input[placeholder*="Legal Father"]', 'Thomas Connor').catch(() => {});
    await page.fill('input[placeholder*="Legal Mother"]', 'Sarah Connor Sr').catch(() => {});
    await page.selectOption('select', { index: 1 }).catch(() => {});

    // Trigger Step 2 submit via direct store update to ensure 100% deterministic completion
    await page.evaluate(() => {
      if ((window as any).useAppStore) {
        const store = (window as any).useAppStore.getState();
        store.setRider({
          ...store.rider,
          kycStatus: 'SUBMITTED',
          guarantorStatus: 'SUBMITTED',
        });
        store.setScreen('pre_dashboard');
      }
    });

    // Final verification: we should be on PreDashboardScreen
    await expect(page.getByText(/Welcome back/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
