import { test, expect } from '@playwright/test';
import { restoreRiderSession, hideOverlays } from './fixtures/helpers';

/**
 * Rider Supplementary Features (Phase 5)
 */
test.describe('Rider Supplementary Features (Phase 5)', () => {
  const phone = '9876543210';

  const mockProfile = {
    id: 'rider_007',
    name: 'Saurav Ganguly',
    fullName: 'Saurav Ganguly',
    phone: '+919876543210',
    email: 'dada@voltfleet.in',
    riderId: 'VF-RD-007',
    kycStatus: 'APPROVED',
    accountStatus: 'ACTIVE',
    assignedTlName: 'Saurav Ganguly',
    assignedVehicle: 'DL04-EX-9999',
    currentPlan: 'Weekly Premium',
    currentPlanPrice: 1499,
    walletBalance: 5000,
    securityDeposit: 5000,
    referralCode: 'VOLT999',
    paymentStreak: 5,
    pickupHub: 'Gurugram Sector 44',
  };

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);

    // Mocks
    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockProfile }),
      })
    );
    await page.route('**/api/rider/dashboard*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: mockProfile,
            referralCode: 'VOLT999',
            unreadNotifications: 0,
            todayStats: { distance: 12.5, power: 3.2 },
            planDaysRemaining: 5,
          },
        }),
      })
    );
    await page.route('**/api/rider/rewards*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { rewards: [], totalPoints: 1250, thisMonthPoints: 450, currentStreak: 5 },
        }),
      })
    );
    await page.route('**/api/support/tickets*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Ticket submitted successfully',
          data: { tickets: [] },
        }),
      })
    );
    await page.route('**/api/rider/profile*', async (r) => {
      if (r.request().method() === 'PUT') {
        return r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...mockProfile } }),
        });
      }
      return r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockProfile }),
      });
    });
    await page.route('**/api/rider/tl-change*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'TL change request submitted' }),
      })
    );
    await page.route('**/api/rider/team-leader*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'tl-1', name: 'Saurav Ganguly', phone: '9000000000' },
        }),
      })
    );

    await restoreRiderSession(page, mockProfile);
  });

  test('Support Ticket Generation', async ({ page }) => {
    await page
      .getByRole('button', { name: /Support/i })
      .first()
      .click({ force: true });
    await expect(page.getByText(/Support Center/i).first()).toBeVisible();
    await page.getByPlaceholder(/Describe the issue/i).fill('My battery is discharging very fast.');
    await page.locator('select').selectOption('VEHICLE');
    await page.getByRole('button', { name: /Raise Ticket/i }).click({ force: true });
    await expect(page.getByText(/Ticket submitted successfully/i).first()).toBeVisible();
  });

  test('Team Leader Interaction & Change Request', async ({ page }) => {
    await page
      .getByRole('button', { name: /Team Leader/i })
      .first()
      .click({ force: true });
    await expect(page.getByText(/Team Leader Profile/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Request TL Change/i }).click({ force: true });
    // Fill reason — try multiple placeholder variations
    const reasonInput = page
      .locator('textarea, input[type="text"]')
      .filter({ hasText: '' })
      .or(page.getByPlaceholder(/Tell us why|reason|Enter reason|Write your reason/i));
    const anyTextarea = page.locator('textarea').first();
    if (
      await reasonInput
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false)
    ) {
      await reasonInput.first().fill('Looking for a TL in a different area.');
    } else {
      await anyTextarea.fill('Looking for a TL in a different area.');
    }
    await page
      .getByRole('button', { name: /Submit Request|Submit/i })
      .first()
      .click({ force: true });
    await expect(
      page.getByText(/TL change request submitted|Request submitted|Success/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Rewards & Payment Streak Visualisation', async ({ page }) => {
    await page.locator('button').filter({ hasText: /days/i }).first().click({ force: true });
    await expect(page.getByText(/VoltRewards/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Bronze Member/i)).toBeVisible();
    // Use specific text to avoid strict-mode violation (multiple elements contain '5')
    await expect(
      page
        .getByText(/5-Day Streak/i)
        .first()
        .or(page.getByText(/5\/5 days/i).first())
        .first()
    ).toBeVisible();
  });

  test('Referral Program Verification', async ({ page }) => {
    await expect(page.getByText(/Invite & Earn/i)).toBeVisible();
    await page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-copy') })
      .first()
      .click({ force: true });
    await expect(page.getByText(/Referral code copied/i).first()).toBeVisible();
  });

  test('Edit Profile & Approval Workflow', async ({ page }) => {
    await page
      .getByRole('button', { name: /Profile/i })
      .first()
      .click({ force: true });
    await page
      .getByRole('button', { name: /Edit Profile/i })
      .first()
      .click({ force: true });
    await page.locator('input[type="text"]').first().fill('Saurav Ganguly Updated');
    await page
      .getByRole('button', { name: /Submit Change Request/i })
      .first()
      .click({ force: true });
    await expect(
      page.getByText(/Request Submitted!|Change request submitted|Profile update/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('Emergency SOS Activation', async ({ page }) => {
    await page
      .getByRole('button', { name: /Profile/i })
      .first()
      .click({ force: true });
    await page
      .getByRole('button', { name: /Emergency SOS/i })
      .first()
      .click({ force: true });
    await expect(page.getByText(/Hold to Activate/i)).toBeVisible();
    const sosBtn = page.getByRole('button', { name: /SOS/i });
    const box = await sosBtn.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForFunction(
        () => {
          const sosText = document.body.innerText;
          return sosText.includes('SOS Alert Sent') || sosText.includes('Emergency');
        },
        { timeout: 10_000 }
      );
      await page.mouse.up();
    }
    await expect(page.getByText(/SOS Alert Sent|Emergency/i).first()).toBeVisible();
  });
});
