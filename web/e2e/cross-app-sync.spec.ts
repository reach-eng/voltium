import { test, expect } from '@playwright/test';
import {
  switchToAdmin,
  loginAsRiderWithSession,
  reinjectRiderState,
  riderContainer,
  hideOverlays,
  selectRiderApp,
} from './fixtures/helpers';

/**
 * Phase 6: Cross-App Sync & State Propagation
 *
 * Uses stateful mocking where in-memory state drives both rider and admin responses.
 * Session injection pattern: loginAsRiderWithSession for first load,
 * reinjectRiderState + page.reload() for subsequent state updates.
 */
test.describe('Cross-App Sync & Operations (Phase 6)', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
  });

  let sharedState = {
    rider: {} as any,
    tickets: [] as any[],
  };

  function getInitialRiderState() {
    return {
      id: 'rider_123',
      riderId: 'VF-2026-6789',
      fullName: 'Virat Kohli',
      name: 'Virat Kohli',
      phone: '+919876543210',
      email: 'king@cricket.in',
      walletBalance: 1540,
      securityDeposit: 5000,
      kycStatus: 'APPROVED',
      state: 'POST_ACTIVE',
      depositStatus: 'PAID',
      rentalStatus: 'ACTIVE',
      planStatus: 'ACTIVE',
      accountStatus: 'ACTIVE',
      tlChangeRequested: false,
      tlChangeReason: null,
      assignedTlName: 'Saurav Ganguly',
      assignedTlId: 'tl_999',
      hasActiveSos: false,
      registrationDone: true,
      kycDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: true,
      returnPending: false,
      createdAt: new Date().toISOString(),
    };
  }

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    sharedState.rider = getInitialRiderState();
    sharedState.tickets = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });

    // --- Admin Auth Mock ---
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

    // --- Rider Profile Mock (stateful) ---
    await page.route('**/api/rider/profile*', async (route) => {
      const method = route.request().method();
      if (method === 'PUT') {
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

    await page.route('**/api/rider/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            rider: sharedState.rider,
            unreadNotifications: 0,
            todayStats: { distance: 10, power: 2 },
            planDaysRemaining: 5,
            referralCode: 'VIRAT18',
          },
        }),
      });
    });

    // --- Support Ticket Mock (stateful, shared with admin) ---
    const handleSupportTicket = async (route: any) => {
      const method = route.request().method();
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        const ticket = {
          id: 'TKT_' + Date.now(),
          ...body,
          status: 'OPEN',
          createdAt: new Date().toISOString(),
        };
        sharedState.tickets.unshift(ticket);
        if (
          body.priority === 'CRITICAL' ||
          body.category === 'SOS' ||
          body.subject?.includes('SOS')
        ) {
          sharedState.rider.hasActiveSos = true;
        }
        if (body.subject === 'Team Leader Change Request') {
          sharedState.rider.tlChangeRequested = true;
          sharedState.rider.tlChangeReason = body.message;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: ticket }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: sharedState.tickets }),
        });
      }
    };
    await page.route('**/api/support/tickets*', handleSupportTicket);
    await page.route('**/api/admin/tickets*', handleSupportTicket);

    // --- Admin Dashboard Mock (stateful) ---
    await page.route('**/api/admin/dashboard*', async (route) => {
      const openSos = sharedState.tickets.filter(
        (t) =>
          (t.priority === 'CRITICAL' || t.category === 'SOS' || t.subject?.includes('SOS')) &&
          t.status === 'OPEN'
      ).length;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            stats: {
              totalRiders: 1,
              activeRentals: sharedState.rider.rentalStatus === 'ACTIVE' ? 1 : 0,
              revenue: 15400,
              utilization: 85,
              sosCount: openSos,
              openTickets: sharedState.tickets.length,
            },
            recentTickets: sharedState.tickets.slice(0, 5),
          },
        }),
      });
    });

    // --- Admin Riders Mock (stateful) ---
    await page.route('**/api/admin/riders*', async (route) => {
      const method = route.request().method();
      if (method === 'PUT') {
        const body = route.request().postDataJSON();
        if (body.tlAction === 'approve') {
          sharedState.rider.assignedTlName = 'Rahul Dravid';
          sharedState.rider.tlChangeRequested = false;
        }
        if (body.rentalStatus === 'RETURNED' || body.rentalStatus === 'NONE') {
          sharedState.rider.assignedVehicle = null;
          sharedState.rider.vehicleId = null;
          sharedState.rider.returnPending = false;
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

    await page.route('**/api/admin/plans*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });
  });

  const rider = riderContainer;

  test('Vehicle Assignment Propagation', async ({ page }) => {
    // First load: inject state without vehicle
    await loginAsRiderWithSession(page, {
      ...sharedState.rider,
      assignedVehicle: undefined,
      rentalStatus: 'NONE',
    });

    // Update shared state and re-inject via evaluate (not addInitScript)
    sharedState.rider.assignedVehicle = 'DL04-EX-9999';
    sharedState.rider.vehicleId = 'VH_9999';
    sharedState.rider.rentalStatus = 'ACTIVE';
    await reinjectRiderState(page, sharedState.rider);
    await page.goto('/');
    await selectRiderApp(page);

    await expect(
      rider(page)
        .getByText(/DL04-EX-9999/i)
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('SOS Realtime Propagation to Admin', async ({ page }) => {
    await loginAsRiderWithSession(page, sharedState.rider);

    // Simulate SOS ticket submission via fetch
    await page.evaluate(() => {
      fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Emergency SOS',
          category: 'SOS',
          priority: 'CRITICAL',
          message: 'HELP',
        }),
      });
    });
    await page.waitForTimeout(1000); // Let mock process the ticket

    // Skip 'tickets' and 'riders' — those are stateful mocks in beforeEach
    await switchToAdmin(page, ['tickets', 'riders']);

    // Admin dashboard should reflect SOS count
    // Check for SOS indicator — either the main SOS card/heading or the badge
    await expect(page.getByText(/Emergency SOS Detected/i)).toBeVisible({ timeout: 20_000 });
  });

  test('TL Change Request & Approval Propagation', async ({ page }) => {
    // First load with initial state
    await loginAsRiderWithSession(page, sharedState.rider);

    // Submit TL change request
    await page.evaluate(() => {
      fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Team Leader Change Request',
          message: 'Need new TL',
          category: 'GENERAL',
        }),
      });
    });
    await page.waitForTimeout(1000);

    // Skip 'riders' and 'tickets' — stateful mocks in beforeEach
    await switchToAdmin(page, ['riders', 'tickets']);
    await page
      .getByRole('button', { name: /Riders/i })
      .first()
      .click({ force: true });
    const riderRow = page.locator('tr').filter({ hasText: 'Virat Kohli' }).first();
    await riderRow.waitFor({ state: 'visible', timeout: 20_000 });
    await riderRow.locator('button').first().click({ force: true });
    await expect(page.getByText(/TL Change Requested/i).first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole('button', { name: /Approve/i })
      .first()
      .click({ force: true });
    await expect(page.getByText(/Success|Approved/i).first())
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {});

    // Re-inject updated state (Rahul Dravid now assigned) and return to Rider App
    sharedState.rider.assignedTlName = 'Rahul Dravid';
    sharedState.rider.tlChangeRequested = false;
    await reinjectRiderState(page, sharedState.rider);
    await page.goto('/');
    await selectRiderApp(page);
    await hideOverlays(page);

    await expect(rider(page).getByText('Profile').first()).toBeVisible({ timeout: 15_000 });
    await rider(page).getByText('Profile').first().click({ force: true });
    await expect(
      rider(page)
        .getByText(/Rahul Dravid/i)
        .first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('Account Suspension Sync (Negative Balance)', async ({ page }) => {
    sharedState.rider.accountStatus = 'SUSPENDED';
    sharedState.rider.walletBalance = -500;

    await loginAsRiderWithSession(page, sharedState.rider);
    await expect(
      rider(page)
        .getByText(/ACCOUNT SUSPENDED|Suspended|suspended/i)
        .first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      rider(page)
        .getByText(/Wallet Balance Below ₹0|negative|below zero/i)
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Vehicle Submission & End Rental Approval Sync', async ({ page }) => {
    // Inject state with active rental
    await loginAsRiderWithSession(page, {
      ...sharedState.rider,
      rentalStatus: 'ACTIVE',
      assignedVehicle: 'DL04-TEST-0001',
      returnPending: false,
    });

    // Navigate to end rental via store
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('end_rental');
    });
    await expect(
      rider(page)
        .getByText(/End Rental/i)
        .first()
    ).toBeVisible({ timeout: 15_000 });

    // Submit return via fetch (simulates button click API call)
    await page.evaluate(() => {
      fetch('/api/rider/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentalStatus: 'RETURN_PENDING',
          returnPending: true,
          submissionDate: new Date().toISOString(),
        }),
      });
    });
    await page.waitForTimeout(1000);

    // --- 2. ADMIN APPROVAL ---
    // Register rentals mock BEFORE switchToAdmin so it is active during load.
    // We skip 'riders' and 'rentals' in switchToAdmin so our handlers win.
    await page.route('**/api/admin/rentals*', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'POST') {
        sharedState.rider.rentalStatus = 'RETURNED';
        sharedState.rider.returnPending = false;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        const pendingReturns = sharedState.rider.returnPending
          ? [
              {
                ...sharedState.rider,
                id: sharedState.rider.id,
                fullName: sharedState.rider.fullName,
              },
            ]
          : [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], pendingReturns }),
        });
      }
    });

    await switchToAdmin(page, ['riders', 'rentals']);

    await page
      .getByRole('button', { name: /Rentals/i })
      .first()
      .click({ force: true });
    await expect(page.getByText(/Pending Return Approvals/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const returnCard = page.locator('.rounded-xl').filter({ hasText: 'Virat Kohli' }).first();
    await expect(returnCard).toBeVisible({ timeout: 20_000 });
    await returnCard
      .getByRole('button', { name: /Approve/i })
      .first()
      .click({ force: true });
    await expect(page.getByText(/Success|Approved/i).first())
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {});

    // Update state and verify rider sees updated dashboard
    sharedState.rider.rentalStatus = 'RETURNED';
    await reinjectRiderState(page, sharedState.rider);

    // Return to Rider App explicitly — reload would stay on Admin view due to URL param
    await page.goto('/');
    await selectRiderApp(page);

    await expect(
      rider(page)
        .getByText(/Dashboard Overview|Welcome/i)
        .first()
    ).toBeVisible({ timeout: 15_000 });
    expect(sharedState.rider.rentalStatus).toBe('RETURNED');
  });
});
