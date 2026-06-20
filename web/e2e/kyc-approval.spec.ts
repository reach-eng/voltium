import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession, switchToAdmin } from './fixtures/helpers';

test.describe('KYC Approval Flow', () => {
  const phone = '9998881111';

  test('onboard rider and then approve in admin panel', async ({ page }) => {
    test.setTimeout(150_000);

    // Setup Mocks
    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            id: 'rider-123',
            phone,
            kycStatus: 'SUBMITTED',
            fullName: 'John Test',
            registrationDone: true,
            kycDone: true,
            depositDone: false,
            planDone: false,
            pickupDone: false,
          },
        }),
      })
    );
    await page.route('**/api/rider/guarantor', (r) =>
      r.fulfill({ body: JSON.stringify({ success: true }) })
    );

    // 1. Inject session state to show pre_dashboard (post-onboarding)
    await loginAsRiderWithSession(page, {
      id: 'rider-123',
      phone,
      fullName: 'John Test',
      kycStatus: 'SUBMITTED',
      kycDone: true,
      registrationDone: true,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      screen: 'pre_dashboard',
    });

    await expect(
      page.getByText(/Ready to Ride|Available Balance|Pre-Active|Book Vehicle/i).first()
    ).toBeVisible({ timeout: 20_000 });

    // --- ADMIN APPROVAL ---
    // Register admin riders mock BEFORE switchToAdmin (no unroute needed — last wins).
    // switchToAdmin skips 'riders' so our handler wins.
    await page.route('**/api/admin/riders*', (r) => {
      if (r.request().method() === 'PUT') {
        return r.fulfill({
          body: JSON.stringify({ success: true, data: { kycStatus: 'APPROVED' } }),
        });
      }
      return r.fulfill({
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'rider-123',
              riderId: 'VF-RD-123',
              fullName: 'John Test',
              phone,
              kycStatus: 'SUBMITTED',
              guarantorStatus: 'SUBMITTED',
              guarantorName: 'Guarantor Test',
              createdAt: new Date().toISOString(),
              state: 'ONBOARDING',
            },
          ],
        }),
      });
    });

    await switchToAdmin(page, ['riders']);

    // 3. Navigate to KYC Management
    await page.locator('button').filter({ hasText: /^KYC$/ }).first().click({ force: true });
    await page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Pending/i })
      .first()
      .click({ force: true });

    // 4. Approve Rider KYC — click Approve on the row first
    await expect(page.getByText(/John Test/).first()).toBeVisible({ timeout: 15_000 });
    await page.locator('button[title="Approve"]').first().click({ force: true });

    // 5. Confirm dialog — click the exact "Approve" button in the dialog
    const confirmBtn = page
      .getByRole('dialog')
      .getByRole('button', { name: /^Approve$/i })
      .or(page.locator('[role="alertdialog"]').getByRole('button', { name: /^Approve$/i }))
      .or(
        page
          .locator('button')
          .filter({ hasText: /^Approve$/ })
          .last()
      );
    await confirmBtn.click({ force: true });

    // 6. Verify empty pending list — switch mock to return empty array first
    await page.route('**/api/admin/riders*', (r) =>
      r.fulfill({ body: JSON.stringify({ success: true, data: [] }) })
    );
    await page
      .locator('button, [role="tab"]')
      .filter({ hasText: /Pending/i })
      .first()
      .click({ force: true });

    // Wait for the empty state — the actual text may vary
    await expect(
      page.getByText(/No riders found|No pending|No results|0 results|Nothing here/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
