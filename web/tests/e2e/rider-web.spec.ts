import { test, expect } from '@playwright/test';

test.describe('Rider Web App E2E', () => {
  test('should navigate from splash screen to active dashboard', async ({ page }) => {
    // Navigate to the Flutter web app running on port 8080
    await page.goto('http://localhost:8080/');

    // Wait a fixed amount of time for Flutter Web to load
    await page.waitForTimeout(10000);
    // Enable accessibility to generate the semantic HTML tree (<flt-semantics>)
    const enableA11yBtn = page.getByRole('button', { name: 'Enable accessibility' });
    if (await enableA11yBtn.isVisible()) {
      await enableA11yBtn.dispatchEvent('click');
    }

    // 1. Splash screen transitions to Login Screen (Phone Input) automatically
    // The phone input has hint text '00000 00000' which is exposed as aria-label
    const phoneInput = page.locator('flt-semantics[aria-label*="00000"], input').first();
    await phoneInput.waitFor({ state: 'attached', timeout: 15000 });
    
    // In CanvasKit, focusing the semantic node activates the underlying text field
    await phoneInput.dispatchEvent('click');
    await phoneInput.fill('1234567890');

    // 2. Click Send OTP (Enter)
    const continueButton = page.locator('flt-semantics[aria-label*="Send OTP"]');
    await continueButton.dispatchEvent('click');

    // 3. OTP Screen
    // Look for OTP input, wait a bit
    const otpInput = page.locator('flt-semantics[aria-label*="Enter OTP"], input').first();
    await otpInput.waitFor({ state: 'attached', timeout: 15000 });
    await otpInput.dispatchEvent('click');
    await otpInput.fill('123456');

    // Click Verify
    const verifyButton = page.locator('flt-semantics[aria-label="Verify OTP"]');
    await verifyButton.dispatchEvent('click');

    // 4. Dashboard
    const dashboardElement = page.locator('flt-semantics[aria-label="Scan to unlock"], flt-semantics[aria-label*="Wallet"]');
    await dashboardElement.waitFor({ state: 'attached', timeout: 20000 });
    
    expect(await dashboardElement.isVisible()).toBeTruthy();
  });
});
