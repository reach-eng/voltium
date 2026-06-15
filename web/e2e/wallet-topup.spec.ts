import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession, switchToAdmin } from './fixtures/helpers';

test.describe('Wallet Top-up Flow', () => {
  const phone = '9998882222';

  test('request top-up and approve in admin panel', async ({ page }) => {
    test.setTimeout(150_000);

    // --- MOCKS (registered before any navigation) ---
    await page.route('**/api/auth/send-otp', (r) =>
      r.fulfill({ body: JSON.stringify({ success: true, otp: '111111' }) })
    );
    await page.route('**/api/auth/verify-otp', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: { id: 'test-rider-topup', phone, name: 'Alex Rider', kycStatus: 'APPROVED' },
        }),
      })
    );

    let walletBalance = 0;
    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-rider-topup',
            phone,
            kycStatus: 'APPROVED',
            kycDone: true,
            registrationDone: true,
            depositDone: true,
            planDone: true,
            pickupDone: true,
            walletBalance,
          },
        }),
      })
    );
    await page.route('**/api/rider/dashboard*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            rider: {
              id: 'test-rider-topup',
              fullName: 'Alex Rider',
              walletBalance,
              kycStatus: 'APPROVED',
            },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 5,
            referralCode: 'AX123',
          },
        }),
      })
    );
    await page.route('**/api/transaction/history', (r) => {
      if (r.request().method() === 'POST') {
        return r.fulfill({ body: JSON.stringify({ success: true }) });
      }
      return r.fulfill({ body: JSON.stringify({ success: true, data: { transactions: [] } }) });
    });
    await page.route('**/api/upload', (r) =>
      r.fulfill({
        body: JSON.stringify({ success: true, data: { url: 'https://example.com/dummy.png' } }),
      })
    );

    // --- 1. RIDER REQUEST TOP-UP (session injection — no OTP needed) ---
    await loginAsRiderWithSession(page, {
      id: 'test-rider-topup',
      phone,
      fullName: 'Alex Rider',
      kycStatus: 'APPROVED',
      kycDone: true,
      walletBalance: 0,
    });

    // Initiate Top-up
    await expect(page.getByText(/Available Balance/i).first()).toBeVisible({ timeout: 20_000 });
    await page
      .getByText(/Top Up/i)
      .first()
      .click({ force: true });

    // Select Purpose: Wallet Top-up
    await expect(page.getByText(/Select Purpose/i).first()).toBeVisible({ timeout: 10_000 });
    await page
      .getByText(/Wallet Top-up/i)
      .first()
      .click();
    await page.click('button:has-text("Continue to Payment")');

    // Select Quick Amount: 500
    await page.getByText(/₹500/).first().click();
    await page.click('button:has-text("Proceed to UPI Payment")');

    // Upload Payment Proof
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/dummy.png');
    await expect(page.getByText(/Photo uploaded successfully/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.click('button:has-text("Submit Proof")');

    // Done with Rider Part
    await expect(page.getByText(/Submitted|Successful/i).first()).toBeVisible({ timeout: 15_000 });

    // --- 2. ADMIN APPROVAL ---
    // Register the admin transactions mock BEFORE switchToAdmin so it
    // exists during the admin page load (no unroute needed — last wins).
    await page.route('**/api/admin/transactions*', (r) => {
      if (r.request().method() === 'PUT' || r.request().method() === 'POST') {
        walletBalance = 500;
        return r.fulfill({ body: JSON.stringify({ success: true }) });
      }
      return r.fulfill({
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'tx-123',
              type: 'TOP_UP',
              amount: 500,
              purpose: 'WALLET_TOPUP',
              status: 'PENDING',
              createdAt: new Date().toISOString(),
              rider: { fullName: 'Alex Rider', phone },
            },
          ],
        }),
      });
    });

    // switchToAdmin skips 'transactions' so our handler above wins.
    await switchToAdmin(page, ['transactions']);

    // Navigate to Transactions → Pending Approvals
    await page
      .locator('button')
      .filter({ hasText: /^Transactions$/ })
      .first()
      .click({ force: true });

    const pendingApprTab = page
      .getByRole('tab', { name: /Pending Approvals/i })
      .first()
      .or(
        page
          .locator('button')
          .filter({ hasText: /Pending Approvals/i })
          .first()
      )
      .or(
        page
          .locator('[role="tab"]')
          .filter({ hasText: /Pending/i })
          .first()
      );
    await pendingApprTab.click({ force: true });

    // Approve Transaction — row should show Alex Rider from our mock
    await expect(page.getByText(/Alex Rider/).first()).toBeVisible({ timeout: 20_000 });
    const row = page
      .locator('tr')
      .filter({ hasText: /Alex Rider/ })
      .first();
    await row.locator('button').nth(1).click({ force: true });
    const approveBtn = page
      .getByRole('dialog')
      .getByRole('button', { name: /^Approve$/i })
      .or(
        page
          .locator('button')
          .filter({ hasText: /^Approve$/ })
          .last()
      );
    await approveBtn.click({ force: true });

    // --- 3. VERIFY BALANCE IN RIDER APP ---
    await loginAsRiderWithSession(page, {
      id: 'test-rider-topup',
      phone,
      fullName: 'Alex Rider',
      kycStatus: 'APPROVED',
      walletBalance: 500,
    });
    await expect(page.getByText(/₹500/).first()).toBeVisible({ timeout: 20_000 });
  });
});
