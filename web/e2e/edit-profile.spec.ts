import { test, expect } from '@playwright/test';
import { selectRiderApp } from './fixtures/helpers';

test.describe('Edit Profile Flow', () => {
  test('rider can edit their profile information and see the update', async ({ page }) => {
    test.setTimeout(150000);
    const initialName = 'John Initial';
    const initialEmail = 'john@initial.com';
    const updatedName = 'John Updated';
    const updatedEmail = 'john@updated.com';

    // --- 1. MOCK RIDER PROFILE ---
    let currentProfile = {
      id: 'rider-123',
      riderId: 'VF-RD-001',
      fullName: initialName,
      email: initialEmail,
      phone: '9991112222',
      kycStatus: 'APPROVED',
    };

    await page.context().route('**/api/rider/profile*', async (r) => {
      if (r.request().method() === 'GET') {
        return r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: currentProfile }),
        });
      }
      if (r.request().method() === 'PUT') {
        const body = await r.request().postDataJSON();
        currentProfile = { ...currentProfile, ...body };
        return r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: currentProfile }),
        });
      }
      return r.continue();
    });

    // --- 2. GOTO RIDER APP ---
    await page.addInitScript(() => {
      const sessionData = {
        state: { riderId: 'rider-123', riderName: 'John Initial' },
        version: 0,
      };
      window.localStorage.setItem('voltium-rider-session', JSON.stringify(sessionData));
    });

    await page.goto('http://localhost:8081');
    await selectRiderApp(page);

    // Navigate internally to profile
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('profile');
    });

    // Verify initial info
    await expect(page.getByText(initialName)).toBeVisible({ timeout: 15000 });

    // --- 3. GO TO EDIT PROFILE ---
    await page.click('button:has-text("Edit Profile")');
    await expect(page.getByText(/Edit Profile/i).first()).toBeVisible();

    // Fill modern inputs
    await page.fill('input[type="text"]', updatedName);
    await page.fill('input[type="email"]', updatedEmail);

    // Submit
    await page.click('button:has-text("Submit Change Request")');

    // Verify success
    await expect(page.getByText(/Request Submitted/i)).toBeVisible({ timeout: 10000 });

    // Wait for redirect back to profile (UI has 2s timeout)
    await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(updatedEmail).first()).toBeVisible();
  });
});
