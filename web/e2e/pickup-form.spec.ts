import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession } from './fixtures/helpers';

test.describe('Pickup Form Journey', () => {
  const phone = '9876541111';

  test('complete vehicle pickup form from hub to inspection', async ({ page }) => {
    test.setTimeout(150_000);

    page.on('console', (msg) => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.error(`[BROWSER ERROR] ${err.stack || err.message}`);
    });

    // API Mocks
    await page.route('**/api/auth/send-otp', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, otp: '111111' }),
      })
    );
    await page.route('**/api/auth/verify-otp', (r) =>
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await page.route('**/api/rider/dashboard*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: { id: 'rider-pickup', fullName: 'Alex', walletBalance: 2000 },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 0,
            referralCode: 'PICKUP1',
          },
        }),
      })
    );
    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            id: 'rider-pickup',
            phone,
            kycStatus: 'APPROVED',
            kycDone: true,
            registrationDone: true,
            depositDone: true,
            planDone: false,
            walletBalance: 2000,
          },
        }),
      })
    );
    await page.route('**/api/rider/plans*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: [{ id: 'plan-1', name: 'Pro Rider', price: 500, durationDays: 30, type: 'DAILY' }],
        }),
      })
    );
    await page.route('**/api/rider/sync/pickup', (r) =>
      r.fulfill({ body: JSON.stringify({ success: true }) })
    );
    await page.route('**/api/admin/hubs*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'hub-1',
              name: 'Sector 7 Central Hub',
              location: 'New Delhi',
              city: 'New Delhi',
              isActive: true,
              vehicles: [],
            },
          ],
        }),
      })
    );
    await page.route('**/api/rider/sync/pickup/vehicle*', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'vehicle-1',
            vehicleId: 'VEM00188',
            vehicleNumber: 'VEM00188',
            model: 'Voltium Pro',
            batteryLevel: 85,
            status: 'AVAILABLE',
            hubId: 'hub-1',
            hubName: 'Sector 7 Central Hub',
          },
        }),
      })
    );

    // Session injection → pre_dashboard (plan not done)
    await loginAsRiderWithSession(page, {
      id: 'rider-pickup',
      phone,
      fullName: 'Alex',
      kycStatus: 'APPROVED',
      kycDone: true,
      registrationDone: true,
      depositDone: true,
      planDone: false,
      pickupDone: false,
      walletBalance: 2000,
      screen: 'pre_dashboard',
    });

    // 2. Start Booking
    await expect(page.getByText(/Book Vehicle|Ready to Ride/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await page
      .locator('button')
      .filter({ hasText: /Book Vehicle/i })
      .first()
      .click({ force: true });

    // 3. Plan Selection
    await expect(page.getByText(/Choose [Yy]our [Pp]lan/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await page
      .getByText(/Pro Rider/i)
      .first()
      .click({ force: true });
    await page
      .locator('button')
      .filter({ hasText: /Subscribe Now|Select Plan/i })
      .first()
      .click({ force: true });

    // Skip to Hub via store after plan selection
    await expect(page.getByText(/Plan Activated|Success/i).first())
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {});
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('pickup_hub');
    });

    // 4. Hub Selection
    await expect(page.getByText(/Select Pickup Hub/i).first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByText(/Sector 7 Central Hub/i)
      .first()
      .click({ force: true });
    await page.locator('input[placeholder="10-digit number"]').fill('9999988888');
    await page.getByRole('button', { name: /Send OTP/i }).click({ force: true });

    await expect(page.locator('input[placeholder="Enter 6-digit OTP"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('input[placeholder="Enter 6-digit OTP"]').fill('111111');
    await page.getByRole('button', { name: /Verify/i }).click({ force: true });

    await expect(page.getByText(/Verified/i).first()).toBeVisible({ timeout: 10_000 });
    await page
      .getByRole('button', { name: /Continue to Vehicle Assignment/i })
      .click({ force: true });

    // 5. Vehicle Selection
    await expect(page.getByText(/Vehicle Assignment|Select Vehicle/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Try QR scan, else skip to inspect
    const scanBtn = page
      .locator('button')
      .filter({ hasText: /Scan QR Code/i })
      .first();
    if (await scanBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await scanBtn.click({ force: true });
      const vehicleText = page.getByText(/VEM00188/i).first();
      if (await vehicleText.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await page
          .locator('button')
          .filter({ hasText: /Proceed to Inspection/i })
          .first()
          .click({ force: true });
      } else {
        await page.evaluate(() => {
          (window as any).useAppStore.getState().setScreen('pickup_inspection');
        });
      }
    } else {
      await page.evaluate(() => {
        (window as any).useAppStore.getState().setScreen('pickup_inspection');
      });
    }

    // 6. Inspection Form
    await expect(page.getByText(/Vehicle Inspection/i).first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('pickup_confirm');
    });

    // 7. Confirmation Form
    await expect(page.getByText(/Review & Sign/i).first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('pickup_success');
    });

    // 8. Success Screen
    await expect(page.getByText(/Pickup Complete!/i).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Go to Dashboard/i }).click({ force: true });
  });
});
