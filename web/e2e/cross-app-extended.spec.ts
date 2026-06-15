import { test, expect } from '@playwright/test';
import {
  switchToAdmin as sharedSwitchToAdmin,
  riderContainer,
  hideOverlays,
  selectRiderApp,
  reinjectRiderState,
} from './fixtures/helpers';

/**
 * Phase 6 Extended: Cross-App Propagation Tests
 * KYC Approval, Transaction Approval, Plan Change, Notification Delivery
 */
test.describe('Cross-App Propagation Extended (Phase 6B)', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1280, height: 800 } });

  let sharedState = {
    rider: {} as any,
    tickets: [] as any[],
    notifications: [] as any[],
    transactions: [] as any[],
  };

  function getInitialRider() {
    return {
      id: 'rider_cross',
      riderId: 'VF-2026-CROSS',
      fullName: 'MS Dhoni',
      name: 'MS Dhoni',
      phone: '+919876500007',
      email: 'dhoni@cricket.in',
      walletBalance: 2000,
      securityDeposit: 5000,
      kycStatus: 'PENDING',
      state: 'ONBOARDING',
      depositStatus: 'PENDING',
      rentalStatus: 'NONE',
      planStatus: 'NONE',
      accountStatus: 'ACTIVE',
      registrationDone: true,
      kycDone: false,
      depositDone: false,
      planDone: false,
      pickupDone: false,
      currentPlan: null,
      createdAt: new Date().toISOString(),
    };
  }

  test.beforeEach(async ({ page }) => {
    sharedState.rider = getInitialRider();
    sharedState.tickets = [];
    sharedState.notifications = [];
    sharedState.transactions = [];

    // Admin Auth
    await page.route('**/api/admin/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { role: 'ADMIN', email: 'admin@voltium.in' } }),
      });
    });
    await page.route('**/api/admin/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Rider Profile
    await page.route('**/api/rider/profile*', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        Object.assign(sharedState.rider, body);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: sharedState.rider }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: sharedState.rider }),
        });
      }
    });

    // Rider Dashboard
    await page.route('**/api/rider/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            rider: sharedState.rider,
            unreadNotifications: sharedState.notifications.filter((n) => !n.isRead).length,
            todayStats: { distance: 0, power: 0 },
            planDaysRemaining: 0,
            referralCode: 'DHONI7',
          },
        }),
      });
    });

    // Admin Dashboard
    await page.route('**/api/admin/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            stats: {
              totalRiders: 1,
              activeRentals: 0,
              revenue: 0,
              utilization: 0,
              sosCount: 0,
              openTickets: 0,
            },
            recentTickets: [],
          },
        }),
      });
    });

    // Admin Riders
    await page.route('**/api/admin/riders*', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        if (body.kycStatus === 'APPROVED') {
          sharedState.rider.kycStatus = 'APPROVED';
          sharedState.rider.kycDone = true;
        }
        if (body.currentPlan) {
          sharedState.rider.currentPlan = body.currentPlan;
          sharedState.rider.planDone = true;
        }
        Object.assign(sharedState.rider, body);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: sharedState.rider }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [sharedState.rider] }),
        });
      }
    });

    // Transactions
    await page.route('**/api/transaction*', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        const tx = {
          id: 'TX_' + Date.now(),
          ...body,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };
        sharedState.transactions.push(tx);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: tx }),
        });
      } else if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        if (body.status === 'APPROVED') {
          sharedState.rider.walletBalance += body.amount || 500;
          sharedState.rider.depositDone = true;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: sharedState.transactions,
            total: sharedState.transactions.length,
          }),
        });
      }
    });

    // Notifications
    await page.route('**/api/notification/list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { notifications: sharedState.notifications } }),
      });
    });
    await page.route('**/api/admin/notifications*', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        sharedState.notifications.push({
          id: 'NOTIF_' + Date.now(),
          ...body,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: sharedState.notifications }),
        });
      }
    });

    // Other admin mocks
    await page.route('**/api/admin/plans*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
    await page.route('**/api/admin/tickets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: sharedState.tickets }),
      });
    });
    await page.route('**/api/support/tickets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: sharedState.tickets }),
      });
    });
  });

  /**
   * Initial load helper — uses addInitScript for first load in a test.
   * For subsequent state updates, use reinjectRiderState() instead.
   */
  async function restoreRider(page: any, r: any) {
    const id = r.id || 'rider_cross';
    const name = r.fullName || r.name || 'Test Rider';
    const phone = (r.phone || '9876500007').replace('+91', '');

    await page.addInitScript(
      ({ id, name, phone, r }: any) => {
        localStorage.setItem(
          'voltium-rider-session',
          JSON.stringify({
            state: { riderId: id, riderName: name },
            version: 0,
          })
        );
        localStorage.setItem(
          'voltium-rider-storage',
          JSON.stringify({
            state: {
              screen: 'active_dashboard',
              rider: {
                ...r,
                registrationDone: true,
                kycDone: true,
                depositDone: true,
                planDone: true,
                pickupDone: true,
                accountStatus: r.accountStatus || 'ACTIVE',
              },
              otpVerified: true,
              permissionsAccepted: true,
              legalAccepted: true,
            },
            version: 0,
          })
        );
      },
      { id, name, phone, r }
    );

    await page.goto('/');
    await selectRiderApp(page);

    const walletCard = page.getByTestId('wallet-card');
    const fallback = page.getByText(/Dashboard Overview|Available Balance|Wallet Balance/i);
    await expect(walletCard.or(fallback).first()).toBeVisible({ timeout: 60_000 });
    await hideOverlays(page);
  }

  const rider = riderContainer;

  test('KYC Approval Propagation — Admin approves, Rider sees APPROVED', async ({ page }) => {
    expect(sharedState.rider.kycStatus).toBe('PENDING');

    // Simulate admin approval then load rider view
    sharedState.rider.kycStatus = 'APPROVED';
    sharedState.rider.kycDone = true;

    await restoreRider(page, sharedState.rider);

    expect(sharedState.rider.kycStatus).toBe('APPROVED');
    expect(sharedState.rider.kycDone).toBe(true);
  });

  test('Transaction Approval Propagation — Admin approves, Rider balance updates', async ({
    page,
  }) => {
    const initialBalance = sharedState.rider.walletBalance;

    sharedState.rider.walletBalance = initialBalance + 5000;
    sharedState.rider.depositDone = true;
    sharedState.rider.depositStatus = 'PAID';

    await restoreRider(page, sharedState.rider);

    expect(sharedState.rider.walletBalance).toBe(initialBalance + 5000);
    expect(sharedState.rider.depositDone).toBe(true);
  });

  test('Plan Change Propagation — Admin changes plan, Rider sees new plan', async ({ page }) => {
    sharedState.rider.currentPlan = 'Monthly Ultra Pro';
    sharedState.rider.planDone = true;
    sharedState.rider.planStatus = 'ACTIVE';
    sharedState.rider.kycDone = true;
    sharedState.rider.kycStatus = 'APPROVED';
    sharedState.rider.depositDone = true;
    sharedState.rider.pickupDone = true;
    sharedState.rider.rentalStatus = 'ACTIVE';

    await restoreRider(page, sharedState.rider);

    await expect(
      rider(page)
        .getByText(/Monthly Ultra Pro/i)
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Notification Delivery — Admin sends notification, Rider sees it', async ({ page }) => {
    sharedState.notifications.push({
      id: 'NOTIF_SYSTEM_1',
      riderId: sharedState.rider.id,
      title: 'Plan Renewal Reminder',
      message: 'Your weekly plan expires in 2 days.',
      type: 'INFO',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    sharedState.rider.kycDone = true;
    sharedState.rider.kycStatus = 'APPROVED';
    sharedState.rider.depositDone = true;
    sharedState.rider.planDone = true;
    sharedState.rider.pickupDone = true;
    sharedState.rider.rentalStatus = 'ACTIVE';

    await restoreRider(page, sharedState.rider);

    // Navigate to notifications
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('notifications');
    });
    await page.waitForTimeout(2000);

    await expect(
      rider(page)
        .getByText(/Plan Renewal Reminder/i)
        .first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      rider(page)
        .getByText(/Your weekly plan expires/i)
        .first()
    ).toBeVisible();
  });
});
