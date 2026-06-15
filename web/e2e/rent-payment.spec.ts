import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession, switchToAdmin } from './fixtures/helpers';

/**
 * Rent Payment Flow (Phase 4)
 * Uses session injection for fast, reliable test setup.
 */
test.describe('Rent Payment Flow', () => {
  const phone = '9998883333';

  test('pay rent via top-up and verify approval', async ({ page }) => {
    test.setTimeout(180_000);

    let walletBalance = 0;
    const mockProfile = {
      id: 'test-rider-rent',
      phone,
      fullName: 'John Rent',
      kycStatus: 'APPROVED',
      kycDone: true,
      registrationDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: true,
      accountStatus: 'ACTIVE',
      walletBalance: 0,
    };

    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ...mockProfile, walletBalance },
        }),
      })
    );
    await page.route('**/api/rider/dashboard*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: { ...mockProfile, walletBalance },
            unreadNotifications: 0,
            todayStats: { distance: 0, power: 0 },
            planDaysRemaining: 7,
            referralCode: 'RENT123',
          },
        }),
      })
    );
    await page.route('**/api/transaction/history*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { transactions: [] } }),
      })
    );
    await page.route('**/api/upload', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { url: 'https://example.com/dummy.png' } }),
      })
    );

    // 1. Session injection — land on active dashboard
    await loginAsRiderWithSession(page, mockProfile);

    // Tap Top Up
    const topUpBtn = page.getByRole('button', { name: /Top Up/i }).first();
    await topUpBtn.click({ force: true });

    // Select Purpose: Wallet Top-up
    await expect(page.getByText(/Select Purpose/i).first()).toBeVisible({ timeout: 10_000 });
    await page
      .getByText(/Wallet Top-up/i)
      .first()
      .click();
    await page
      .locator('button')
      .filter({ hasText: /Continue to Payment/i })
      .first()
      .click({ force: true });

    // Enter Amount: 1500
    await expect(page.getByText(/Enter Amount/i).first()).toBeVisible({ timeout: 10_000 });
    await page.locator('input[inputMode="numeric"]').fill('1500');
    await page
      .locator('button')
      .filter({ hasText: /Proceed to UPI Payment/i })
      .first()
      .click({ force: true });

    // Upload Payment Proof
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/dummy.png');
    await expect(page.getByText(/Photo uploaded successfully/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page
      .locator('button')
      .filter({ hasText: /Submit Proof/i })
      .first()
      .click({ force: true });

    // Success
    await expect(page.getByText(/Submitted|Successful|Receipt/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // --- 2. ADMIN APPROVAL ---
    // Register the transactions mock BEFORE switchToAdmin so it exists during page load.
    // switchToAdmin skips 'transactions' so our handler wins.
    await page.route('**/api/admin/transactions*', (r) => {
      if (r.request().method() === 'PUT' || r.request().method() === 'POST') {
        walletBalance = 1500;
        return r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
      return r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'tx-456',
              type: 'TOP_UP',
              amount: 1500,
              status: 'PENDING',
              createdAt: new Date().toISOString(),
              rider: { fullName: 'John Rent', phone },
            },
          ],
        }),
      });
    });

    await switchToAdmin(page, ['transactions']);

    // Navigate and Approve
    await page
      .locator('button')
      .filter({ hasText: /Transactions/i })
      .first()
      .click({ force: true });

    // Tab or button for "Pending Approvals"
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

    await expect(page.getByText(/John Rent/).first()).toBeVisible({ timeout: 20_000 });
    await page
      .locator('tr')
      .filter({ hasText: /John Rent/ })
      .locator('button')
      .nth(1)
      .click({ force: true });

    // Confirm approve dialog
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

    // --- 3. VERIFY UPDATED BALANCE IN RIDER APP ---
    await loginAsRiderWithSession(page, { ...mockProfile, walletBalance: 1500 });
    await expect(page.getByText(/₹1,500/).first()).toBeVisible({ timeout: 20_000 });
  });
});
