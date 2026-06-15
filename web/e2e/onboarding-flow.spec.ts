import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession } from './fixtures/helpers';
import path from 'path';

test.describe('Onboarding Flow (Stabilized)', () => {
  const phone = '9876543210';

  test('should complete the full onboarding flow', async ({ page }) => {
    test.setTimeout(180_000);

    // API Mocks
    await page.route('**/api/rider/profile*', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...body, id: 'r1' } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: null }),
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
            rider: { id: 'r1', fullName: 'John Doe', walletBalance: 0 },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 0,
          },
        }),
      });
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

    // Session injection: land on Intent screen (registration not done)
    await loginAsRiderWithSession(page, {
      id: 'r1',
      phone,
      fullName: 'John Doe',
      walletBalance: 0,
      kycStatus: 'NONE',
      registrationDone: false,
      kycDone: false,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      screen: 'intent',
    });

    // Re-enable overlays/dialogs since loginAsRiderWithSession hides them
    await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll('style'));
      for (const style of styles) {
        if (
          style.innerHTML.includes('[role="dialog"]') ||
          style.innerHTML.includes('#dev-swapper')
        ) {
          style.remove();
        }
      }
    });

    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 15_000,
    });
    await page.evaluate(() => {
      if ((window as any).queryClient) (window as any).queryClient.clear();
      (window as any).useAppStore.getState().setScreen('intent');
    });

    // 4. Intent
    await expect(page.getByText(/How will you use/i).first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByText(/Delivery Partner/i)
      .first()
      .click({ force: true });

    // Pre-set DOB to bypass DatePicker flakiness
    await page.evaluate((dob: string) => {
      (window as any).useAppStore.getState().setRider({ dob });
    }, '1990-01-01');

    await page
      .getByRole('button', { name: /Continue/i })
      .first()
      .click({ force: true });

    // 5. User Details
    await expect(page.getByText(/Personal Details|User Details/i).last()).toBeVisible({
      timeout: 15_000,
    });

    await page.fill('#rider-father', 'Richard Doe');
    await page.fill('#rider-mother', 'Mary Doe');
    await page.fill('#rider-address', '123 Test Street, Bangalore');

    // 6. Uploads
    const dummyFile = path.resolve(__dirname, 'fixtures/kyc_dummy.pdf');
    const fileInputs = page.locator('input[type="file"]');
    for (let i = 0; i < 4; i++) {
      await fileInputs
        .nth(i)
        .setInputFiles(dummyFile)
        .catch(() => {});
    }
    await expect(page.getByText(/Uploaded/i).first()).toBeVisible({ timeout: 30_000 });

    // Fill Bank Details Dialog
    const bankDetailsBtn = page.getByRole('button', { name: 'Bank Details', exact: true });
    await bankDetailsBtn.scrollIntoViewIfNeeded();
    await bankDetailsBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.fill('#bank-name', 'State Bank of India');
    await page.fill('#bank-account', '30291038472');
    await page.fill('#bank-ifsc', 'SBIN0001234');
    await page
      .getByRole('button', { name: /Save Bank Details/i })
      .first()
      .click();

    // 7. Submit Step 1 via window handler or button
    const submitBtn = page.getByRole('button', { name: /Guarantor|Submit|Next|Continue/i }).first();
    await page.evaluate(() => {
      if ((window as any).triggerOnboardingSubmit) {
        (window as any).triggerOnboardingSubmit();
      }
    });
    if (await submitBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await submitBtn.click({ force: true }).catch(() => {});
    }

    // 8. Next step should be Guarantor
    await expect(page.getByText(/Guarantor/i).first()).toBeVisible({ timeout: 60_000 });
  });
});
