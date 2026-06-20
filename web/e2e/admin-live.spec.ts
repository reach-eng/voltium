import { test, expect } from '@playwright/test';

test.describe('Admin Live Payload Hooks (Phase 4)', () => {
  // Use a wide desktop viewport for the admin panel
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Mock Realtime Dashboard Sync', async ({ page }) => {
    test.setTimeout(45_000);

    // Provide a mocked network response for the dashboard polling route
    await page.route('**/api/admin/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            totalRiders: 154,
            activeRiders: 154,
            totalVehicles: 50,
            availableVehicles: 20,
            totalBalance: 25000,
            totalDeposits: 500000,
            pendingTransactions: 2,
            openTickets: 1, // Alert condition triggers SOS visually
            activeRentals: 30,
          },
        }),
      });
    });

    // We can also route the SOS Ticket response explicitly
    await page.route('**/api/admin/tickets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'test-sos-ticket',
              ticketId: 'SOS-001',
              subject: 'Emergency Panic Button Triggered',
              category: 'SOS',
              status: 'OPEN',
              priority: 'CRITICAL',
              createdAt: new Date().toISOString(),
              rider: { fullName: 'Realtime Mock Rider', riderId: 'VF-TEST-100' },
            },
          ],
        }),
      });
    });

    // Navigate to admin
    await page.goto('/?view=admin');

    // Wait for the auth state to settle
    const dashboard = page.getByText(/Welcome back/i).first();
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });

    await expect(dashboard.or(loginBtn).first()).toBeVisible({ timeout: 25_000 });

    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      // Wait for navigation and dashboard to appear
      await page
        .locator('.shimmer, :text("Loading...")')
        .first()
        .waitFor({ state: 'detached', timeout: 20_000 })
        .catch(() => {});
      await expect(dashboard).toBeVisible({ timeout: 45_000 });
    }

    // Wait for the SOS alert component which pops up if `openTickets` && `category == SOS` > 0
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByText(/Emergency SOS Detected/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Assert visual pulsing indicator exists on the radar ticket alert
    const pingIndicator = page.locator('.animate-ping').first();
    await expect(pingIndicator).toBeVisible();

    // Verify mocked revenue mapping formatting logic
    await expect(page.getByText(/25,000/i).first()).toBeVisible();
  });

  test('Device Tracking View — Verify GPS data renders for active riders', async ({ page }) => {
    test.setTimeout(45_000);

    // Auth and dashboard mocks FIRST — prevents race during page load (fix #3)
    await page.route('**/api/admin/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { role: 'SUPER_ADMIN', email: 'admin@voltium.in' },
        }),
      });
    });
    await page.route('**/api/admin/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { stats: {} } }),
      });
    });

    // Feature-specific mocks
    await page.route('**/api/admin/riders*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            riders: [
              {
                id: 'rider-test-01',
                riderId: 'VF-RD-99',
                phone: '9999999999',
                fullName: 'GPS Test Rider',
                kycStatus: 'APPROVED',
                state: 'POST_ACTIVE',
                walletBalance: 1000,
              },
            ],
          },
          pagination: { totalPages: 1, total: 1 },
        }),
      });
    });

    await page.route('**/api/admin/riders/rider-test-01/device-data', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            contacts: [],
            callLogs: [],
            locations: [
              {
                lat: 28.7041,
                lng: 77.1025,
                accuracy: 5.5,
                speed: 45,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        }),
      });
    });

    // Navigate to admin and log in
    await page.goto('/?view=admin');
    const dashboard = page.getByText(/Welcome back/i).first();
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });

    // Wait for either the dashboard or the login button to appear
    await expect(dashboard.or(loginBtn).first()).toBeVisible({ timeout: 30_000 });

    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      // Wait for navigation and dashboard to appear
      await page
        .locator('.shimmer, :text("Loading...")')
        .first()
        .waitFor({ state: 'detached', timeout: 20_000 })
        .catch(() => {});
      await expect(dashboard).toBeVisible({ timeout: 45_000 });
    }

    // Click "Riders" in the sidebar
    await page.locator('[data-nav-id="riders"]').first().click({ force: true });
    await page
      .locator('.shimmer, :text("Loading...")')
      .first()
      .waitFor({ state: 'detached', timeout: 15_000 })
      .catch(() => {});

    // Wait for riders table and click "View Details" (Eye icon)
    const eyeBtn = page.locator('button[title="View Details"]').first();
    await eyeBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await eyeBtn.click();

    // Switch to "Phone Access" tab
    const deviceTab = page.getByRole('tab', { name: /Phone Access/i });
    await deviceTab.waitFor({ state: 'visible', timeout: 10_000 });
    await deviceTab.click();

    // Switch to "Live GPS" sub-tab in DeviceTrackingView
    const liveGpsBtn = page.getByRole('button', { name: /Live GPS/i });
    await liveGpsBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await liveGpsBtn.click();

    // Verify coordinates and speed from our mock data
    await expect(page.getByText(/28\.704100, 77\.102500/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Speed: 45 km\/h/i).first()).toBeVisible();
  });
});
