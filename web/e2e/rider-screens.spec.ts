import { test, expect } from '@playwright/test';
import { loginAsRider, selectRiderApp, restoreRiderSession } from './fixtures/helpers';

/**
 * Phase 5 Extended: Rider Screens — Notifications, Settings, Documents, Rental Details, History
 */
test.describe('Rider Screens Extended (Phase 5B)', () => {
  const phone = '5081024053';
  test.use({ viewport: { width: 375, height: 812 } });

  const mockProfile = {
    id: 'rider_test',
    name: 'Virat Kohli',
    fullName: 'Virat Kohli',
    phone: '+919876543210',
    email: 'virat@voltfleet.in',
    riderId: 'VF-RD-018',
    kycStatus: 'APPROVED',
    accountStatus: 'ACTIVE',
    assignedTlName: 'Saurav Ganguly',
    assignedVehicle: 'DL04-EX-9999',
    currentPlan: 'Weekly Premium',
    currentPlanPrice: 1499,
    walletBalance: 5000,
    securityDeposit: 5000,
    referralCode: 'VIRAT18',
    paymentStreak: 5,
    aadhaarFront: 'https://example.com/aadhaar_front.jpg',
    aadhaarBack: 'https://example.com/aadhaar_back.jpg',
    panCard: 'https://example.com/pan.jpg',
    signature: 'https://example.com/sign.jpg',
    guarantorAadhaarFront: 'https://example.com/g_aadhaar_front.jpg',
    guarantorAadhaarBack: 'https://example.com/g_aadhaar_back.jpg',
    guarantorPan: 'https://example.com/g_pan.jpg',
    guarantorVideo: 'https://example.com/g_video.mp4',
    guarantorSignature: 'https://example.com/g_sign.jpg',
    guarantorStatus: 'VERIFIED',
    rentalStatus: 'ACTIVE',
  };

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);

    // Auth Mocks
    await page.route('**/api/auth/send-otp', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, otp: '111111' }),
      })
    );
    await page.route('**/api/auth/verify-otp', (r) =>
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'rider_test',
            phone,
            name: 'Virat Kohli',
            kycStatus: 'APPROVED',
            registrationDone: true,
            kycDone: true,
            depositDone: true,
            planDone: true,
            pickupDone: true,
            accountStatus: 'ACTIVE',
          },
        }),
      })
    );

    await page.route('**/api/rider/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockProfile }),
      });
    });
    await page.route('**/api/rider/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            rider: mockProfile,
            unreadNotifications: 2,
            todayStats: { distance: 15, power: 3 },
            planDaysRemaining: 3,
            referralCode: 'VIRAT18',
          },
        }),
      });
    });

    // Notifications mock
    await page.route('**/api/notification/list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            notifications: [
              {
                id: 'n1',
                title: 'Payment Confirmed',
                message: 'Your ₹500 top-up has been approved.',
                type: 'PAYMENT',
                isRead: false,
                createdAt: new Date().toISOString(),
              },
              {
                id: 'n2',
                title: 'Vehicle Assigned',
                message: 'DL04-EX-9999 has been assigned to you.',
                type: 'VEHICLE',
                isRead: true,
                createdAt: new Date(Date.now() - 3600000).toISOString(),
              },
              {
                id: 'n3',
                title: 'Safety Reminder',
                message: 'Always wear your helmet while riding.',
                type: 'INFO',
                isRead: false,
                createdAt: new Date(Date.now() - 86400000).toISOString(),
              },
            ],
          },
        }),
      });
    });

    // Transactions mock
    await page.route('**/api/transaction*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            transactions: [
              {
                id: 'tx1',
                amount: 500,
                type: 'CREDIT',
                purpose: 'TOP_UP',
                status: 'APPROVED',
                description: 'Wallet Top Up',
                createdAt: '2026-04-10T10:00:00Z',
                breakdowns: [],
              },
            ],
            total: 1,
          },
        }),
      });
    });

    await restoreRiderSession(page, mockProfile);
  });

  test('Notifications Screen — View and "Mark all as read"', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('notifications');
    });
    await expect(page.getByText('Notifications').first()).toBeVisible({ timeout: 15_000 });

    // Verify notifications render
    await expect(page.getByText(/Payment Confirmed/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Vehicle Assigned/i).first()).toBeVisible();
    await expect(page.getByText(/Safety Reminder/i).first()).toBeVisible();

    // Mark all as read button
    await expect(page.getByText(/Mark all as read/i)).toBeVisible();
  });

  test('My Documents Screen — View uploaded KYC documents', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('my_documents');
    });
    await expect(page.getByText(/My Documents/i).first()).toBeVisible({ timeout: 15_000 });

    // Verification status card
    await expect(page.getByText(/Security Profile/i)).toBeVisible();
    await expect(page.getByText(/Verified & Secure/i)).toBeVisible();

    // Personal documents
    await expect(page.getByText(/Your Documents/i).first()).toBeVisible();
    await expect(page.getByText(/Aadhaar Card \(Front\)/i).first()).toBeVisible();
    await expect(page.getByText(/PAN Card/i).first()).toBeVisible();

    // Guarantor documents
    await expect(page.getByText(/Guarantor's Documents/i).first()).toBeVisible();
    await expect(page.getByText(/Guarantor's Aadhaar/i).first()).toBeVisible();

    // Support link
    await expect(page.getByText(/Having trouble with documents/i)).toBeVisible();
    await expect(page.getByText(/Contact Support/i)).toBeVisible();
  });

  test('Rental Details Screen — View vehicle and plan info', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('rental_details');
    });
    await expect(page.getByText(/DL04-EX-9999|Rental Details/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('History Screen — Navigate from Wallet', async ({ page }) => {
    // Start on Wallet screen
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('wallet');
    });
    await expect(page.getByText(/Available Balance/i).first()).toBeVisible({ timeout: 10_000 });

    // Click History button
    await page.getByRole('button', { name: /History/i }).click({ force: true });

    // Verify History screen
    await expect(page.getByText(/Transaction History/i).first()).toBeVisible({ timeout: 15_000 });
    // Verify summary cards
    await expect(page.getByText(/Credits/i).first()).toBeVisible();
    await expect(page.getByText(/Debits/i).first()).toBeVisible();
  });
});
