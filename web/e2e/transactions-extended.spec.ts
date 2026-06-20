import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession, selectRiderApp } from './fixtures/helpers';

/**
 * Phase 2 Extended: Transaction History, Amount Presets, UPI Validation
 * Uses session injection (no OTP) for reliable beforeEach setup.
 */
test.describe('Transactions Extended (Phase 2B)', () => {
  const phone = '5081024053';
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);

    // API Mocks
    await page.route('**/api/transaction/history*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              transactions: [
                {
                  id: 'tx1',
                  amount: 5000,
                  type: 'CREDIT',
                  purpose: 'TOP_UP',
                  status: 'APPROVED',
                  description: 'Wallet Top Up',
                  createdAt: new Date().toISOString(),
                  breakdowns: [{ label: 'Base Amount', amount: 5000, type: 'CHARGE' }],
                },
                {
                  id: 'tx2',
                  amount: 299,
                  type: 'DEBIT',
                  purpose: 'RENTAL_FEE',
                  status: 'SUCCESS',
                  description: 'Daily Rental Fee',
                  createdAt: new Date().toISOString(),
                  breakdowns: [
                    { label: 'Rental', amount: 265, type: 'CHARGE' },
                    { label: 'GST', amount: 34, type: 'TAX' },
                  ],
                },
                {
                  id: 'tx3',
                  amount: 1000,
                  type: 'CREDIT',
                  purpose: 'SECURITY_DEPOSIT',
                  status: 'PENDING',
                  description: 'Security Deposit',
                  createdAt: new Date().toISOString(),
                  breakdowns: [],
                },
              ],
              pagination: {
                page: 1,
                limit: 10,
                total: 3,
                totalPages: 1,
                hasNext: false,
                hasPrev: false,
              },
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { status: 'PENDING' } }),
        });
      }
    });

    await page.route('**/api/files/request-upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { uploadUrl: '/api/files/direct-upload?key=test-key', fileRecordId: 'rec-1', storageKey: 'test-key' },
        }),
      });
    });
    await page.route('**/api/files/direct-upload*', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ status: 'ok' }) });
    });
    await page.route('**/api/files/confirm-upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { status: 'uploaded' } }),
      });
    });

    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'r1',
            riderId: 'VF-RD-001',
            fullName: 'Test User',
            walletBalance: 5000,
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
    await page.route('**/api/rider/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: { id: 'r1', riderId: 'VF-RD-001', fullName: 'Test User', walletBalance: 5000 },
            unreadNotifications: 0,
            todayStats: { distance: 10, power: 5 },
            planDaysRemaining: 5,
            referralCode: 'TEST',
          },
        }),
      });
    });

    // Session injection — skips OTP, goes straight to dashboard
    await loginAsRiderWithSession(page, {
      id: 'r1',
      phone,
      fullName: 'Test User',
      riderId: 'VF-RD-001',
      walletBalance: 5000,
      kycStatus: 'APPROVED',
      kycDone: true,
      registrationDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: true,
    });

    // Wait for dashboard
    await expect(
      page.getByText(/VF-RD-001|Dashboard Overview|Action Required/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('Transaction History — View, Filter & Expand', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('history');
    });
    await expect(page.getByText(/Wallet Top Up/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Transaction History/i).first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(/Credits/i).first()).toBeVisible();
    await expect(page.getByText(/Debits/i).first()).toBeVisible();
    await expect(page.getByText(/Net/i).first()).toBeVisible();

    await expect(page.getByText(/Wallet Top Up/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Daily Rental Fee/i).first()).toBeVisible();

    // Filter
    await page.getByText('Credits', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(500);
    await page.getByText('Debits', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: /^All$/i }).first().click({ force: true });

    // Search
    await page.getByPlaceholder(/Search transactions/i).fill('Rental');
    await page.waitForTimeout(500);
    await expect(page.getByText(/Daily Rental Fee/i).first()).toBeVisible();
  });

  test('Top-Up Amount Presets — Quick-fill buttons', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('top_up_purpose');
    });
    await expect(page.getByText(/Select Purpose/i).first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByText(/Security Deposit/i)
      .first()
      .click({ force: true });
    await page.getByRole('button', { name: /Continue to Payment/i }).click({ force: true });

    await expect(page.getByText(/Enter Amount/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /₹500/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /₹1,000/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /₹5,000/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /₹500/i }).first().click({ force: true });
    await page
      .getByRole('button', { name: /₹1,000/i })
      .first()
      .click({ force: true });
  });

  test('Photo Upload Validation — Submit disabled without photo', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).useAppStore.getState();
      store.setTopUpState(5000, 'WALLET_TOPUP');
      store.setScreen('top_up_upi');
    });
    await expect(page.getByText(/Top Up/i).first()).toBeVisible({ timeout: 15_000 });

    const submitBtn = page.getByRole('button', { name: /Submit Proof/i });
    await expect(submitBtn).toBeDisabled();

    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/dummy.png');
    await expect(page.getByText(/Photo uploaded successfully/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(submitBtn).toBeEnabled();
  });
});
