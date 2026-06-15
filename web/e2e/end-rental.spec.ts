import { test, expect } from '@playwright/test';
import { selectRiderApp } from './fixtures/helpers';

test.describe('End Rental Flow', () => {
  test('rider can complete the vehicle return process', async ({ page }) => {
    test.setTimeout(150000);
    const riderId = 'rider-active-123';

    // --- 1. MOCK DASHBOARD & PROFILE ---
    let returnPending = false;

    await page.context().route('**/api/rider/profile*', async (r) => {
      if (r.request().method() === 'GET') {
        return r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: riderId,
              riderId: 'VF-RD-ACTV',
              fullName: 'Active Rider',
              name: 'Active Rider',
              accountStatus: 'ACTIVE',
              rentalStatus: returnPending ? 'PENDING_RETURN' : 'ACTIVE',
              planStatus: 'ACTIVE',
              returnPending: returnPending,
              assignedVehicle: 'VOLT-001',
              pickupHub: 'South Hub',
              planEndDate: new Date(Date.now() + 86400000 * 5).toISOString(),
            },
          }),
        });
      }
      if (r.request().method() === 'PUT') {
        const body = await r.request().postDataJSON();
        if (body.returnPending) returnPending = true;
        return r.fulfill({
          body: JSON.stringify({ success: true, data: { ...body, id: riderId } }),
        });
      }
      return r.continue();
    });

    // Mock dashboard API
    await page.context().route('**/api/rider/dashboard*', (r) => {
      return r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rider: {
              id: riderId,
              name: 'Active Rider',
              riderId: 'VF-RD-ACTV',
              accountStatus: 'ACTIVE',
              walletBalance: 1000,
              currentPlanPrice: 500,
              returnPending: returnPending,
            },
            referralCode: 'REF123',
            unreadNotifications: 0,
            todayStats: { distance: 12.5, power: 1.2 },
            planDaysRemaining: 5,
          },
        }),
      });
    });

    // --- 2. GOTO RIDER APP ---
    await page.addInitScript(() => {
      const sessionData = {
        state: { riderId: 'rider-active-123', riderName: 'Active Rider' },
        version: 0,
      };
      window.localStorage.setItem('voltium-rider-session', JSON.stringify(sessionData));
    });

    await page.goto('http://localhost:8081');
    await selectRiderApp(page);

    // Mock app state to be on active_dashboard
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('active_dashboard');
    });

    // --- 3. NAVIGATE TO RENTAL DETAILS ---
    await page.click('button:has-text("Manage Subscription")');
    await expect(page.getByText(/Rental Details/i)).toBeVisible();

    // --- 4. START END RENTAL ---
    await page.click('button:has-text("End Rental")');
    await expect(page.getByText(/Are you sure?/i)).toBeVisible();

    // --- 5. COMPLETE INSPECTION ---
    // Click all 4 photo slots
    await page.click('#photo-slot-front');
    await page.click('#photo-slot-rear');
    await page.click('#photo-slot-left');
    await page.click('#photo-slot-right');

    // Enter Odometer
    await page.fill('#odometer-input', '1500');

    // Confirm
    await page.click('#confirm-rental-checkbox', { force: true });

    // Submit
    await page.click('#submit-return-button', { force: true });

    // --- 6. VERIFY SUCCESS & DASHBOARD STATE ---
    // Should show success state in EndRentalScreen first?
    await expect(page.getByText(/Request Submitted/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Dashboard Overview/i)).toBeVisible({ timeout: 15000 });

    // Verify Pending Approval Banner
    await expect(page.getByText(/Return Pending Approval/i)).toBeVisible();
    await expect(page.getByText(/Awaiting Admin Approval/i)).toBeVisible();
  });
});
