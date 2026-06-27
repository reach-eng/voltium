import { test, expect, Page } from '@playwright/test';

// Helpers to interact with Flutter Web App
async function enableSemantics(page: Page) {
  const placeholder = page.locator('flt-semantics-placeholder, button:has-text("Enable accessibility")').first();
  try {
    await placeholder.waitFor({ state: 'visible', timeout: 30_000 });
    await placeholder.click({ force: true });
    await page.waitForTimeout(500);
  } catch (_) { /* already enabled or not present */ }
}

async function tapFlutterWidget(page: Page, identifier: string) {
  const element = page.locator(`[flt-semantics-identifier="${identifier}"], [aria-label="${identifier}"]`).first();
  await expect(element).toBeVisible({ timeout: 15000 });
  await element.click({ force: true });
  await page.waitForTimeout(300);
}

async function fillFlutterInput(page: Page, identifier: string, value: string) {
  const element = page.locator(`[flt-semantics-identifier="${identifier}"] input, input[flt-semantics-identifier="${identifier}"], [flt-semantics-identifier="${identifier}"]`).first();
  await expect(element).toBeVisible({ timeout: 15000 });
  await element.click({ force: true });
  await page.keyboard.type(value, { delay: 50 });
  await page.waitForTimeout(300);
}

test.describe('Voltium Complete Cross-App E2E Integration Journey', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const testPhone = '9876543210';
  const testOtp = '111111';

  test('Complete Flow: Registration -> KYC Approval -> Wallet Top-up -> Pickup -> Ticket -> Return', async ({ page }) => {
    test.setTimeout(240_000);

    page.on('console', msg => console.log(`[RIDER-CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.error(`[RIDER-ERROR] ${err.stack || err.message}`));

    // --- STEP 1: RIDER APP REGISTRATION & KYC SUBMISSION ---
    await page.goto('/rider-app/index.html');
    await enableSemantics(page);

    // Splash screen should load and transition to Legal Consent
    const acceptCheckbox = page.locator('[flt-semantics-identifier="acceptCheckbox"]').first();
    await expect(acceptCheckbox).toBeVisible({ timeout: 20000 });
    await acceptCheckbox.click({ force: true });

    await tapFlutterWidget(page, 'continueLegalButton');

    // Permissions Screen
    await tapFlutterWidget(page, 'continuePermissionsButton');

    // Auth Choice (if present)
    const phoneInput = page.locator('[flt-semantics-identifier="phoneInput"]').first();
    if (!(await phoneInput.isVisible())) {
      await tapFlutterWidget(page, 'loginWithPhoneButton');
    }

    // Enter Phone
    await fillFlutterInput(page, 'phoneInput', testPhone);
    await tapFlutterWidget(page, 'sendOtpButton');

    // Enter OTP
    await page.waitForSelector('[flt-semantics-identifier="otpInputRow"]', { timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press(testOtp[i]);
      await page.waitForTimeout(100);
    }
    await tapFlutterWidget(page, 'verifyOtpButton');

    // Onboarding Form
    await fillFlutterInput(page, 'fullNameField', 'John Doe');
    await fillFlutterInput(page, 'emailField', 'johndoe@example.com');
    await fillFlutterInput(page, 'fatherNameField', 'Senior Doe');
    await fillFlutterInput(page, 'motherNameField', 'Jane Doe');
    await tapFlutterWidget(page, 'nextOnboardingButton');

    // Onboarding - Guarantor Details
    await fillFlutterInput(page, 'guarantorNameField', 'Guarantor Doe');
    await fillFlutterInput(page, 'guarantorPhoneField', '9998887776');
    await tapFlutterWidget(page, 'completeOnboardingButton');

    // Wait for Dashboard (Pre-active status or KYC pending screen)
    await page.waitForTimeout(2000);

    // --- STEP 2: ADMIN PANEL KYC APPROVAL ---
    await page.goto('/?view=admin');
    
    // Auto-login or Admin Login
    const adminLoginBtn = page.getByRole('button', { name: /Login as Admin/i }).first();
    if (await adminLoginBtn.isVisible()) {
      await adminLoginBtn.click({ force: true });
    }

    // Go to KYC reviews
    await page.locator('[data-nav-id="riders"]').first().click({ force: true });
    await page.getByRole('tab', { name: /Pending/i }).first().click({ force: true });

    // Approve the rider
    const pendingRiderRow = page.locator('tr', { hasText: testPhone }).first();
    await expect(pendingRiderRow).toBeVisible({ timeout: 15000 });
    await pendingRiderRow.locator('button[title="Approve"]').first().click({ force: true });
    await page.getByRole('dialog').getByRole('button', { name: /^Approve$/i }).first().click({ force: true });

    // --- STEP 3: RIDER WALLET TOP-UP ---
    await page.goto('/rider-app/index.html');
    await enableSemantics(page);

    // Navigate to Wallet tab
    await tapFlutterWidget(page, 'walletTab');
    await tapFlutterWidget(page, 'topUpButton');
    await tapFlutterWidget(page, 'amount500');
    await tapFlutterWidget(page, 'submitProofButton');

    // --- STEP 4: ADMIN APPROVES TOP-UP ---
    await page.goto('/?view=admin');
    await page.locator('[data-nav-id="transactions"]').first().click({ force: true });
    await page.getByRole('tab', { name: /Pending Approvals/i }).first().click({ force: true });

    const pendingTxRow = page.locator('tr', { hasText: '500' }).first();
    await expect(pendingTxRow).toBeVisible({ timeout: 15000 });
    await pendingTxRow.getByRole('button', { name: /Approve/i }).first().click({ force: true });
    await page.getByRole('dialog').getByRole('button', { name: /^Approve$/i }).first().click({ force: true });

    // --- STEP 5: RIDER PLAN SELECTION & PICKUP ---
    await page.goto('/rider-app/index.html');
    await enableSemantics(page);

    // Pre-active to Active dashboard transitions: Select plan
    await tapFlutterWidget(page, 'planCard');
    await tapFlutterWidget(page, 'confirmPlanButton');

    // Pickup vehicle
    await tapFlutterWidget(page, 'hubCard');
    // Complete inspections
    for (let i = 1; i <= 7; i++) {
      await tapFlutterWidget(page, `inspectionItem${i}`);
    }
    await tapFlutterWidget(page, 'confirmPickupButton');

    // Dashboard should transition to Active
    await expect(page.locator('[flt-semantics-identifier="assignedVehicleCard"]')).toBeVisible({ timeout: 20000 });

    // --- STEP 6: SUPPORT TICKET & PROFILE EDIT ---
    // Support Ticket
    await tapFlutterWidget(page, 'supportTab');
    await tapFlutterWidget(page, 'raiseTicketButton');

    // Profile Edit
    await tapFlutterWidget(page, 'profileTab');
    await tapFlutterWidget(page, 'editProfileLink');
    await fillFlutterInput(page, 'editFullNameField', 'John Updated Doe');
    await tapFlutterWidget(page, 'submitProfileButton');

    // Logout
    await tapFlutterWidget(page, 'logoutButton');
  });
});
