import { test, expect } from '@playwright/test';
import { loginAsRider, loginAsRiderWithSession } from './fixtures/helpers';

/**
 * Phase 7: Edge Cases & Error Handling
 *
 * Pattern:
 * - Tests that test the OTP/login UI flow use loginAsRider().
 * - Tests that just need a logged-in rider use loginAsRiderWithSession().
 * - ALL API mocks are registered before any navigation.
 */
test.describe('Edge Cases & Error Handling (Phase 7)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    // Auth mocks
    await page.route('**/api/auth/send-otp', (r) =>
      r.fulfill({ body: JSON.stringify({ success: true, otp: '111111' }) })
    );
    await page.route('**/api/auth/verify-otp', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            id: 'edge_rider',
            phone: '9876543210',
            name: 'Edge User',
            kycStatus: 'NONE',
            registrationDone: false,
          },
        }),
      })
    );
    // Profile mock so app doesn't hang on "Loading experience..."
    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'edge_rider',
            phone: '9876543210',
            fullName: 'Edge User',
            kycStatus: 'NONE',
            accountStatus: 'ACTIVE',
            registrationDone: false,
          },
        }),
      })
    );
    await page.route('**/api/rider/dashboard*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: { id: 'edge_rider', fullName: 'Edge User', walletBalance: 0 },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 0,
            referralCode: 'EDGE',
          },
        }),
      })
    );
  });

  test('Invalid OTP Handling — Wrong OTP shows error', async ({ page }) => {
    // Override verify-otp to fail with invalid OTP error
    await page.route('**/api/auth/verify-otp', (r) =>
      r.fulfill({ status: 400, body: JSON.stringify({ success: false, error: 'Invalid OTP' }) })
    );

    // Inject a partial session (otpVerified=false) so the app shows the OTP screen
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch (_) {}
      try {
        sessionStorage.clear();
      } catch (_) {}
      localStorage.setItem(
        'voltium-rider-storage',
        JSON.stringify({
          state: {
            screen: 'otp',
            otpVerified: false,
            permissionsAccepted: true,
            legalAccepted: true,
            rider: { phone: '9876543210' },
          },
          version: 0,
        })
      );
    });

    await page.goto('/');
    // Select rider app
    const riderBtn = page.locator('#rider-app-btn');
    const returnBtn = page.getByRole('button', { name: /Return to Rider App/i }).first();
    await expect(riderBtn.or(returnBtn).first()).toBeVisible({ timeout: 30_000 });
    if (await riderBtn.isVisible()) await riderBtn.click({ force: true });
    else await returnBtn.click({ force: true });

    // Wait for store to hydrate then force OTP screen
    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 15_000,
    });
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('otp');
    });

    // Wait for OTP input
    const otpInput = page.locator('input[type="text"], input[inputmode="numeric"]').first();
    await otpInput.waitFor({ state: 'visible', timeout: 20_000 });
    await otpInput.fill('000000'); // Wrong OTP
    await page
      .getByRole('button', { name: /Verify|Submit/i })
      .first()
      .click({ force: true });

    // Should show error since mock returns 400
    await expect(page.getByText(/Invalid OTP|incorrect|error|wrong/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Empty State Handling — No transactions empty screen', async ({ page }) => {
    await page.route('**/api/transaction*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { transactions: [], total: 0 } }),
      });
    });
    await page.route('**/api/notification/list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { notifications: [] } }),
      });
    });

    // Use session injection so we land on dashboard immediately
    await loginAsRiderWithSession(page, {
      id: 'empty_rider',
      fullName: 'Empty User',
      walletBalance: 0,
      screen: 'active_dashboard',
    });

    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 15_000,
    });

    // Navigate to notifications
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('notifications');
    });
    await expect(
      page.getByText(/You're all caught up!|No notifications|No new notifications/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to history
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('history');
    });
    await expect(
      page.getByText(/No transactions found|no activity|No records/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Network Failure Recovery — API error does not crash app', async ({ page }) => {
    // Override profile to fail — app should handle gracefully
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await loginAsRiderWithSession(page, {
      id: 'net_rider',
      fullName: 'Net Rider',
      walletBalance: 0,
    });

    await expect(page.locator('body')).not.toContainText(/Loading/i, { timeout: 10_000 });
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
    // App should not crash — any visible state is acceptable
    await expect(page.locator('body')).toBeVisible();
  });

  test('Duplicate Phone Login — Same phone re-login', async ({ page }) => {
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'dup_rider',
            fullName: 'Dup User',
            walletBalance: 1000,
            kycStatus: 'APPROVED',
            accountStatus: 'ACTIVE',
            registrationDone: true,
            kycDone: true,
            depositDone: true,
            planDone: true,
            pickupDone: true,
          },
        }),
      });
    });

    await loginAsRiderWithSession(page, {
      id: 'dup_rider',
      fullName: 'Dup User',
      walletBalance: 1000,
      kycStatus: 'APPROVED',
      screen: 'active_dashboard',
    });

    await expect(page.getByText(/Dup User/i).first()).toBeVisible({ timeout: 20_000 });

    // Re-login (reload and verify app recovers)
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toContainText(/Application error/i, { timeout: 10_000 });
    await expect(page.getByText(/Dashboard|Login|Rider App|Admin/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Session Expiry — Expired state redirects gracefully', async ({ page }) => {
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    // Inject session then reload — 401 on profile should trigger logout/redirect
    await loginAsRiderWithSession(page, {
      id: 'exp_rider',
      fullName: 'Exp Rider',
      walletBalance: 0,
    });
    await page.reload({ waitUntil: 'networkidle' });

    // Should recover — not crash
    await expect(page.locator('body')).not.toContainText(/Application error/i, { timeout: 10_000 });
    await expect(page.getByText(/Login|Enter your phone|Rider App|Dashboard/i).first()).toBeVisible(
      { timeout: 15_000 }
    );
  });

  test('Rate Limiting — Rapid API calls handled gracefully', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/rider/profile*', async (route) => {
      callCount++;
      if (callCount > 5) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Too Many Requests' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'rate_rider',
              fullName: 'Rate Test',
              walletBalance: 500,
              kycStatus: 'APPROVED',
              registrationDone: true,
              kycDone: true,
              depositDone: true,
              planDone: true,
              pickupDone: true,
            },
          }),
        });
      }
    });

    await loginAsRiderWithSession(page, {
      id: 'rate_rider',
      fullName: 'Rate Test',
      walletBalance: 500,
    });
    await expect(page.getByText(/Rate Test/i).first()).toBeVisible({ timeout: 15_000 });

    // Rapid reloads to trigger rate limiting
    await page.reload();
    await page.reload();
    await page.reload();

    // App should not crash
    await expect(page.locator('body')).not.toContainText(/Application error/i, { timeout: 10_000 });
    await expect(page.getByText(/Login|Enter|Rider App|Dashboard|Admin/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('File Upload Validation — KYC upload inputs exist', async ({ page }) => {
    // Inject session at KYC screen state
    await loginAsRiderWithSession(page, {
      id: 'kyc_rider',
      fullName: 'KYC Rider',
      walletBalance: 0,
      kycStatus: 'NONE',
      kycDone: false,
      registrationDone: true,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      screen: 'kyc',
    });

    // Wait for store, then force KYC screen and reload so React hydrates it
    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 15_000,
    });
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('kyc');
    });
    // Reload with injected state so Next.js SSR picks up kyc screen from localStorage
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 15_000,
    });
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('kyc');
    });

    // Now KYC form should render with file inputs
    await expect(page.locator('input[type="file"]').first()).toBeVisible({ timeout: 20_000 });

    const fileInputs = page.locator('input[type="file"]');
    const fileCount = await fileInputs.count();
    expect(fileCount).toBeGreaterThanOrEqual(1);
  });

  test('Concurrent State Mutations — Rapid store updates', async ({ page }) => {
    await loginAsRiderWithSession(page, {
      id: 'concurrent_rider',
      fullName: 'Concurrent User',
      walletBalance: 1000,
    });

    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 15_000,
    });
    await page.evaluate(() => {
      if ((window as any).queryClient) (window as any).queryClient.clear();
      const store = (window as any).useAppStore.getState();
      const session = (window as any).useRiderSession?.getState();
      if (session) session.setRiderSession('concurrent_rider', 'Concurrent User');
      for (let i = 0; i < 10; i++) {
        store.setRider({
          id: 'concurrent_rider',
          fullName: 'Concurrent User',
          walletBalance: 1000 + i * 100,
          registrationDone: true,
          kycDone: true,
          depositDone: true,
          planDone: true,
          pickupDone: true,
        });
        store.setScreen('active_dashboard');
      }
    });
    await expect(page.locator('body')).not.toContainText(/Loading/i, { timeout: 10_000 });

    const finalBalance = await page.evaluate(() => {
      return (window as any).useAppStore.getState().rider?.walletBalance;
    });
    expect(finalBalance).toBe(1900);

    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toBeTruthy();
  });
});
