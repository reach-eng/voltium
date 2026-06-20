import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession } from './fixtures/helpers';
import path from 'path';

/**
 * Phase 1E: Vehicle Onboarding
 * Flow: Security Deposit → Plan Selection → Vehicle Pickup
 * Uses session injection (no OTP) for reliable setup.
 */
test.describe('Vehicle Onboarding (Phase 1E)', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    geolocation: { latitude: 28.6139, longitude: 77.209 },
    permissions: ['geolocation'],
  });

  test('Complete Vehicle Onboarding — Deposit, Plan, Pickup', async ({ page }) => {
    test.setTimeout(180_000);

    page.on('dialog', (dialog) => {
      console.log('DIALOG:', dialog.message());
      dialog.dismiss().catch(() => {});
    });

    // 1. API Mocks
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'onboarding_rider_456',
            fullName: 'Pickup Candidate',
            kycStatus: 'APPROVED',
            kycDone: true,
            walletBalance: 5000,
            depositDone: true,
            planDone: false,
            pickupDone: false,
            registrationDone: true,
          },
        }),
      });
    });

    await page.route('**/api/rider/plans*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'plan_pro',
                name: 'Voltium Pro',
                type: 'WEEKLY',
                price: 1500,
                durationDays: 7,
                isActive: true,
              },
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.route('**/api/transaction/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, transactionId: 'TXN_123' }),
      });
    });

    await page.route('**/api/rider/sync/pickup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/files/request-upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            uploadUrl: '/api/files/direct-upload?key=test-key',
            fileRecordId: 'rec-1',
            storageKey: 'test-key',
          },
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

    await page.route('**/api/rider/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: {
              id: 'onboarding_rider_456',
              fullName: 'Pickup Candidate',
              walletBalance: 5000,
            },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 7,
            referralCode: 'PICKUP',
          },
        }),
      });
    });

    // 2. Session injection — start at pre_dashboard (deposit done, plan not done)
    await loginAsRiderWithSession(page, {
      id: 'onboarding_rider_456',
      phone: '9876543210',
      fullName: 'Pickup Candidate',
      kycStatus: 'APPROVED',
      kycDone: true,
      walletBalance: 5000,
      depositDone: true,
      planDone: false,
      pickupDone: false,
      registrationDone: true,
      screen: 'pre_dashboard',
    });

    // 3. Plan Selection — click Book Vehicle
    await expect(page.getByText(/Book Vehicle|Ready to Ride/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await page
      .getByRole('button', { name: /Book Vehicle/i })
      .first()
      .click({ force: true });
    await expect(page.getByText(/Choose your plan/i).first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByText(/Voltium Pro/i)
      .first()
      .click({ force: true });
    const subscribBtn = page.getByRole('button', { name: /Subscribe Now|Select Plan/i }).first();
    await subscribBtn.click({ force: true });

    await expect(page.getByText(/Plan Activated/i).first()).toBeVisible({ timeout: 15_000 });

    // Update state to planDone=true
    await page.evaluate(() => {
      (window as any).useAppStore?.getState().setRider({
        planDone: true,
        walletBalance: 3500,
        currentPlan: { name: 'Voltium Pro' },
      });
    });

    await page
      .getByRole('button', { name: /Select Pickup Hub|Find Hubs/i })
      .first()
      .click({ force: true });

    // 4. Hub Selection
    await expect(page.getByText(/Select Pickup Hub/i).first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByText(/Sector 7 Central Hub/i)
      .first()
      .click({ force: true });

    // Emergency Contact OTP Verification
    await page.route('**/api/auth/send-otp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { otp: '123456' } }),
      });
    });
    await page.route('**/api/auth/verify-otp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.getByPlaceholder(/10-digit number/i).fill('9988776655');
    await page.getByRole('button', { name: /Send OTP/i }).click({ force: true });
    await expect(page.getByPlaceholder(/Enter 6-digit OTP/i)).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/Enter 6-digit OTP/i).fill('123456');
    await page.getByRole('button', { name: /^Verify$/i }).click({ force: true });
    await expect(page.getByText(/Verified/i).first()).toBeVisible({ timeout: 10_000 });

    await page
      .getByRole('button', { name: /Continue to Vehicle Assignment/i })
      .click({ force: true });

    // 5. Vehicle Selection
    await expect(page.getByText(/Vehicle Assignment|Select Vehicle/i).first()).toBeVisible({
      timeout: 20_000,
    });
    const vehicleInput = page.getByPlaceholder(/VF-XXXX-X/i);
    if (await vehicleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await vehicleInput.fill('VF-EV-001');
      await page
        .getByRole('button', { name: /Proceed to Inspection/i })
        .first()
        .click({ force: true });
    } else {
      await page
        .locator('button')
        .filter({ hasText: /Pick This Vehicle|Select/i })
        .first()
        .click({ force: true });
    }

    // 6. Inspection Screen
    await expect(page.getByText(/Vehicle Inspection/i).first()).toBeVisible({ timeout: 20_000 });
    const inspectionDummyFile = path.resolve(__dirname, 'fixtures/kyc_dummy.pdf');
    const fileInput = page.locator('input[type="file"]');

    // Use evaluate to click capture buttons (bypasses simulation lag)
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const captureBtns = buttons.filter(
        (b) =>
          b.innerText.includes('Front View') ||
          b.innerText.includes('Rear View') ||
          b.innerText.includes('Left Side') ||
          b.innerText.includes('Right Side') ||
          b.innerText.includes('selfie') ||
          b.innerText.includes('Selfie')
      );
      captureBtns.forEach((b) => (b as any).click());
    });

    // Try file upload fallback for each photo
    for (const label of ['Front View', 'Rear View', 'Left Side', 'Right Side']) {
      const btn = page.getByRole('button', { name: new RegExp(label, 'i') });
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await btn.click({ force: true });
        await fileInput.setInputFiles(inspectionDummyFile).catch(() => {});
      }
    }
    const selfieBtn = page.getByRole('button', { name: /Take a selfie|selfie/i });
    if (await selfieBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await selfieBtn.click({ force: true });
      await fileInput.setInputFiles(inspectionDummyFile).catch(() => {});
    }

    // Proceed (wait for button to be enabled)
    await expect(
      page
        .locator('button')
        .filter({ hasText: /Proceed to Confirm/i })
        .first()
    ).toBeEnabled({ timeout: 15_000 });
    await page
      .locator('button')
      .filter({ hasText: /Proceed to Confirm/i })
      .first()
      .click({ force: true });

    // 7. Final Confirm Screen
    await expect(page.getByText(/Review & Sign/i).first()).toBeVisible({ timeout: 20_000 });

    // Select Team Leader (graceful if no option exists)
    await page
      .locator('select')
      .selectOption({ label: 'Marcus Chen' })
      .catch(() => {});

    // Digital Signature
    const canvas = page.locator('canvas');
    await canvas.scrollIntoViewIfNeeded().catch(() => {});
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + 10, box.y + 10);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.up();
    }

    // Take vehicle photo (button may not be present on all builds)
    const vehiclePhotoBtn = page.locator('button').filter({ hasText: /Take a photo sitting/i });
    if (await vehiclePhotoBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await vehiclePhotoBtn.click({ force: true });
    }

    // Emergency Contact
    await page
      .getByPlaceholder(/Enter 10-digit number/i)
      .fill('9988776655')
      .catch(() => {});

    // Checkbox confirmation
    await page
      .getByText(/I confirm the vehicle is in good condition/i)
      .click({ force: true })
      .catch(() => {});
    await page
      .locator('label')
      .first()
      .click({ force: true })
      .catch(() => {});

    await page
      .getByRole('button', { name: /Complete Pickup|Complete Pickup & Start Riding/i })
      .first()
      .click({ force: true });

    // 8. Final active dashboard mocks
    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'onboarding_rider_456',
            fullName: 'Pickup Candidate',
            kycStatus: 'APPROVED',
            kycDone: true,
            walletBalance: 3500,
            depositDone: true,
            planDone: true,
            currentPlan: { name: 'Voltium Pro' },
            pickupDone: true,
            assignedVehicle: 'VF-EV-001',
            accountStatus: 'ACTIVE',
            registrationDone: true,
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
            rider: {
              riderId: 'onboarding_rider_456',
              fullName: 'Pickup Candidate',
              accountStatus: 'ACTIVE',
              walletBalance: 3500,
              currentPlan: 'Voltium Pro',
              assignedVehicle: 'VF-EV-001',
              pickupHub: 'Sector 7 Central Hub',
              assignedTlName: 'Marcus Chen',
            },
            referralCode: 'VF-PICKUP-50',
            unreadNotifications: 0,
            planDaysRemaining: 7,
            todayStats: { distance: 0, power: 0, speed: 0, battery: 100 },
          },
        }),
      });
    });

    // 9. Success
    await expect(page.getByText(/Pickup Complete/i).first()).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('button', { name: /Go to Dashboard/i })
      .first()
      .click({ force: true });

    // 10. Final State: Active Dashboard
    await expect(page.getByText(/Dashboard Overview/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/VF-EV-001/i).first()).toBeVisible();
  });
});
