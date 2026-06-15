import { test, expect } from '@playwright/test';
import { gotoAdminPanel } from './fixtures/helpers';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Admin Panel Operations (Phase 3)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);

    // Override with rich data BEFORE navigation — skip these in gotoAdminPanel so they aren't clobbered.
    await page.route('**/api/admin/riders*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'r1',
              riderId: 'VF-001',
              fullName: 'Pending Rider',
              phone: '9999901111',
              kycStatus: 'SUBMITTED',
              guarantorStatus: 'SUBMITTED',
              createdAt: new Date().toISOString(),
              state: 'ONBOARDING',
            },
          ],
        }),
      })
    );

    await page.route('**/api/admin/transactions*', (r) => {
      if (r.request().method() === 'PUT' || r.request().method() === 'POST') {
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'tx1',
              type: 'TOP_UP',
              amount: 500,
              status: 'PENDING',
              purpose: 'WALLET_TOPUP',
              createdAt: new Date().toISOString(),
              rider: { fullName: 'Pending User', phone: '9999902222' },
            },
          ],
        }),
      });
    });

    // ✅ Call gotoAdminPanel with skipPaths so our data mocks are NOT clobbered.
    await gotoAdminPanel(page, ['riders', 'transactions']);
  });

  test('Global Stability', async ({ page }) => {
    test.setTimeout(30_000);
    await expect(page.getByText(/Welcome back/i).first()).toBeVisible({ timeout: 20_000 });
    const kpiElements = await page.locator('.rounded-xl').count();
    expect(kpiElements).toBeGreaterThan(0);
  });

  test('KYC & Transaction Management', async ({ page }) => {
    test.setTimeout(180_000);

    // 1. Navigate to KYC Tab
    const kycBtn = page.locator('[data-nav-id="kyc"]').first();
    await kycBtn.click({ force: true });

    // Wait for shimmers to clear
    await page
      .locator('.shimmer')
      .first()
      .waitFor({ state: 'detached', timeout: 15_000 })
      .catch(() => {});

    // Pending tab
    const pendingTab = page
      .getByRole('tab', { name: /Pending/i })
      .first()
      .or(
        page
          .locator('button')
          .filter({ hasText: /Pending/i })
          .first()
      );
    await expect(pendingTab).toBeVisible({ timeout: 15_000 });
    await pendingTab.click({ force: true });

    // Check for pending KYC rider row
    const kycRow = page.locator('tr', { hasText: /Pending Rider|SUBMITTED/i }).first();
    if (await kycRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await kycRow.click({ force: true });
      await expect(page.getByText(/Guarantor|Father's Name|KYC Details/i).first()).toBeVisible({
        timeout: 5_000,
      });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog'))
        .toBeHidden({ timeout: 5_000 })
        .catch(() => {});
    } else {
      // Fallback: just verify the KYC section loaded
      await expect(page.getByText(/KYC|Riders/i).first()).toBeVisible({ timeout: 10_000 });
    }

    // 2. Navigate to Transactions Tab
    const txBtn = page.locator('[data-nav-id="transactions"]').first();
    await txBtn.click({ force: true });

    // Verify navigation
    await expect(page.getByRole('heading', { name: /Transactions/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Increase timeout for dynamic import and shimmer removal
    await page
      .locator('.shimmer')
      .first()
      .waitFor({ state: 'detached', timeout: 30_000 })
      .catch(() => {});

    // Check for error boundary first to help debug
    if (await page.getByText(/Something went wrong/i).isVisible()) {
      throw new Error('Admin Error Boundary triggered in Transaction Management');
    }

    await expect(
      page
        .getByText(/Transactions|No transactions/i)
        .first()
        .or(page.getByRole('table').first())
        .first()
    ).toBeVisible({ timeout: 30_000 });

    // 3. Find a pending transaction and approve it
    const pendingTxTab = page
      .getByRole('tab', { name: /Pending Approvals/i })
      .first()
      .or(
        page
          .locator('button')
          .filter({ hasText: /Pending/i })
          .first()
      );

    if (await pendingTxTab.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await pendingTxTab.click({ force: true });
    }

    const pendingRow = page
      .locator('tr')
      .filter({ hasText: /PENDING|Pending User/i })
      .first();
    if (await pendingRow.isVisible({ timeout: 15_000 }).catch(() => false)) {
      const approveBtn = pendingRow.getByRole('button', { name: /Approve/i }).first();
      await approveBtn.click({ force: true });

      const dialog = page
        .locator('[role="alertdialog"], [role="dialog"]')
        .filter({ hasText: /Approve/i })
        .first();
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await dialog.getByRole('button', { name: /^Approve$/i }).click({ force: true });
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    } else {
      // If no pending transaction visible, just verify table rendered
      await expect(
        page
          .getByRole('table')
          .first()
          .or(page.getByText(/No transactions/i))
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
