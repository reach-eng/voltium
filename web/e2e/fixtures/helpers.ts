import { Page, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────
// ADMIN HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Sets up a comprehensive set of Admin API route mocks.
 * Must be called BEFORE page.goto() so that the mocks intercept
 * all requests made during the initial page load.
 *
 * @param skipPaths  Array of path segments to skip registering.
 *   For example ['transactions', 'riders'] will NOT register
 *   routes for those paths (useful when a test pre-registered
 *   specific data for those routes).
 */
export async function setupAdminMocks(page: Page, skipPaths: string[] = []) {
  await page.route('**/api/admin/auth/me', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'admin1',
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          email: 'admin@voltfleet.com',
        },
      }),
    })
  );

  await page.route('**/api/admin/auth/login', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'admin1',
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          email: 'admin@voltfleet.com',
          token: 'mock-token',
        },
      }),
    })
  );

  await page.route('**/api/admin/dashboard*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          stats: {
            totalRiders: 50,
            activeRentals: 12,
            revenue: 125000,
            utilization: 85,
            openTickets: 3,
            sosCount: 0,
          },
          recentTransactions: [],
          recentTickets: [],
          auditLogs: [],
        },
      }),
    })
  );

  const allPaths = [
    'riders',
    'transactions',
    'tickets',
    'audit-logs',
    'plans',
    'vehicles',
    'notifications',
    'faqs',
    'offers',
    'rewards',
    'referrals',
    'team-leaders',
    'users',
    'legal',
    'rentals',
    'settings',
  ];
  for (const path of allPaths) {
    if (skipPaths.includes(path)) continue; // honour caller's override
    await page.route(`**/api/admin/${path}*`, async (route) => {
      if (
        route.request().method() === 'PUT' ||
        route.request().method() === 'POST' ||
        route.request().method() === 'DELETE'
      ) {
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
            success: true,
            data: [],
            pagination: { total: 0, page: 1 },
            pendingReturns: [],
          }),
        });
      }
    });
  }
}

/**
 * Robustly waits for the application to hydrate and be interactive.
 * Checks for specific hydration markers in the DOM.
 */
export async function waitForAppHydration(
  page: Page,
  mode: 'rider' | 'admin' = 'rider',
  timeout = 30_000
) {
  const marker = mode === 'admin' ? '#admin-hydration-marker' : '#hydration-marker';
  try {
    await page.waitForSelector(marker, { state: 'attached', timeout });
    // Brief settle to ensure state effects have run
    await page.waitForTimeout(500);
  } catch (e) {
    console.warn(
      `[Hydration] Warning: ${marker} not found within ${timeout}ms. App might be unstable.`
    );
  }
}

/**
 * Navigates directly to the Admin Panel using the ?view=admin URL param.
 * Sets up mocks first to ensure no real API calls are made.
 * Handles the dev "Login as Admin" button if present.
 *
 * @param skipPaths  Forwarded to setupAdminMocks — paths already mocked by the caller.
 */
export async function gotoAdminPanel(page: Page, skipPaths: string[] = []) {
  await setupAdminMocks(page, skipPaths);
  await page.goto('/?view=admin', { waitUntil: 'networkidle', timeout: 30_000 });
  await waitForAppHydration(page, 'admin');

  const dashboard = page.getByText(/Welcome back/i).first();
  const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
  await expect(dashboard.or(loginBtn)).toBeVisible({ timeout: 30_000 });
  if (await loginBtn.isVisible()) {
    await loginBtn.click({ force: true });
    await expect(page.getByText(/Welcome back/i).first()).toBeVisible({ timeout: 30_000 });
    await waitForAppHydration(page, 'admin');
  }
}

/**
 * Switches to the Admin Panel view from anywhere.
 * Uses the reliable ?view=admin URL approach.
 *
 * @param skipPaths  Forwarded to setupAdminMocks — paths already mocked by the caller.
 */
export async function switchToAdmin(page: Page, skipPaths: string[] = []) {
  await setupAdminMocks(page, skipPaths);
  await page.goto('/?view=admin', { waitUntil: 'networkidle', timeout: 30_000 });
  const dashboard = page.getByText(/Welcome back/i).first();
  const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
  await expect(dashboard.or(loginBtn)).toBeVisible({ timeout: 20_000 });
  if (await loginBtn.isVisible()) {
    await loginBtn.click({ force: true });
    await expect(page.getByText(/Welcome back/i).first()).toBeVisible({ timeout: 20_000 });
  }
}

// ─────────────────────────────────────────────────────────────
// RIDER AUTH HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Full OTP login flow for tests that specifically test the login/OTP UI.
 * Uses addInitScript to clear localStorage BEFORE the page loads, guaranteeing
 * the app always starts on the login/phone-entry screen.
 * Only use this when you need to test the actual login flow.
 */
export async function loginAsRider(page: Page, phone = '9876543210', referralCode?: string) {
  // ✅ KEY FIX: Clear localStorage via addInitScript so it runs BEFORE React
  // hydrates. If we evaluate() after goto() it's too late — the app has already
  // read the old keys and decided which screen to show.
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch (_) {}
    try {
      sessionStorage.clear();
    } catch (_) {}
  });

  // Navigate fresh
  const url = referralCode ? `/?ref=${referralCode}` : '/';
  await page.goto(url);

  // Select Rider App
  await selectRiderApp(page);

  // Bypass the permissions screen that appears on a fresh (empty storage) load
  await bypassPermissionsScreen(page);

  // Wait for phone input — if still not visible, try one reload
  const phoneInput = page.getByPlaceholder(/00000 00000/i).first();
  try {
    await phoneInput.waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    // If permissions screen appeared again after a delayed load, handle it
    await bypassPermissionsScreen(page);
    await phoneInput.waitFor({ state: 'visible', timeout: 20_000 });
  }

  // Fill phone with retry
  for (let i = 0; i < 3; i++) {
    await phoneInput.click();
    await phoneInput.fill(phone);
    if ((await phoneInput.inputValue()) === phone) break;
    await page.waitForTimeout(300);
  }

  await page
    .getByRole('button', { name: /Login|Continue/i })
    .first()
    .click({ force: true });

  // OTP screen
  const otpInput = page.locator('input[type="text"], input[inputmode="numeric"]').first();
  await otpInput.waitFor({ state: 'visible', timeout: 15_000 });
  await otpInput.fill('111111');

  await page
    .getByRole('button', { name: /Verify|Submit/i })
    .first()
    .click({ force: true });
}

/**
 * Clicks through the App Permissions screen (Location, Battery, Contacts, Call Register)
 * that appears on a fresh storage load before the login screen.
 * Safe to call even if the permissions screen is not present.
 */
export async function bypassPermissionsScreen(page: Page) {
  // Check if permissions screen is visible (max 3s wait)
  const allowBtn = page.getByRole('button', { name: /ALLOW|Allow/i }).first();
  const isPermissionsScreen = await allowBtn.isVisible({ timeout: 3_000 }).catch(() => false);

  if (!isPermissionsScreen) return;

  // Click all ALLOW buttons until none remain
  for (let i = 0; i < 10; i++) {
    const btn = page.getByRole('button', { name: /ALLOW|Allow/i }).first();
    if (!(await btn.isVisible({ timeout: 1_000 }).catch(() => false))) break;
    await btn.click({ force: true });
    await page.waitForTimeout(300);
  }

  // Also handle "Continue" or "Accept" buttons that may follow
  const continueBtn = page.getByRole('button', { name: /Continue|Accept|Next/i }).first();
  if (await continueBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await continueBtn.click({ force: true });
  }
}

/**
 * Fast session restore — injects an authenticated rider state into localStorage
 * via addInitScript (runs BEFORE page load) then navigates to the app.
 *
 * Use this for tests that need a logged-in rider WITHOUT going through OTP.
 * This is the preferred method for feature tests (wallet, support, etc.)
 */
export async function loginAsRiderWithSession(
  page: Page,
  riderData: Partial<{
    id: string;
    name: string;
    fullName: string;
    phone: string;
    riderId: string;
    walletBalance: number;
    kycStatus: string;
    accountStatus: string;
    registrationDone: boolean;
    kycDone: boolean;
    depositDone: boolean;
    planDone: boolean;
    pickupDone: boolean;
    screen: string;
    [key: string]: any;
  }> = {}
) {
  const id = riderData.id || 'session_rider';
  const name = riderData.fullName || riderData.name || 'Test Rider';
  const phone = (riderData.phone || '9876543210').replace('+91', '');
  const screen = riderData.screen || 'active_dashboard';

  const fullRider = {
    id,
    phone,
    fullName: name,
    riderId: riderData.riderId || 'VF-RD-001',
    walletBalance: riderData.walletBalance ?? 5000,
    kycStatus: riderData.kycStatus || 'APPROVED',
    accountStatus: riderData.accountStatus || 'ACTIVE',
    registrationDone: riderData.registrationDone ?? true,
    kycDone: riderData.kycDone ?? true,
    depositDone: riderData.depositDone ?? true,
    planDone: riderData.planDone ?? true,
    pickupDone: riderData.pickupDone ?? true,
    ...riderData,
  };

  // Inject localStorage BEFORE page load via addInitScript
  await page.addInitScript(
    ({ id, name, phone, screen, fullRider }) => {
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
            screen,
            rider: fullRider,
            otpVerified: true,
            permissionsAccepted: true,
            legalAccepted: true,
          },
          version: 0,
        })
      );
    },
    { id, name, phone, screen, fullRider }
  );

  await page.goto('/');

  // Wait for hydration marker before proceeding
  await waitForAppHydration(page, 'rider');

  await selectRiderApp(page);

  // ✅ Screen-aware wait: different screens show different anchor text.
  // For dashboard screens — wait for wallet/balance. For other screens — wait
  // for any recognizable UI element so we don't timeout on 'legal', 'intent', etc.
  const DASHBOARD_SCREENS = ['active_dashboard', 'pre_dashboard', 'wallet'];
  if (DASHBOARD_SCREENS.includes(screen)) {
    const walletCard = page.getByTestId('wallet-card');
    const fallback = page.getByText(
      /Dashboard Overview|Available Balance|Wallet Balance|Ready to Ride/i
    );
    await expect(walletCard.or(fallback).first()).toBeVisible({ timeout: 60_000 });
  } else {
    // For non-dashboard screens (legal, intent, kyc, etc.) just wait for app to
    // be past the loading state — any button or heading is enough.
    await page.waitForFunction(() => typeof (window as any).useAppStore !== 'undefined', {
      timeout: 30_000,
    });
    await page.waitForTimeout(500); // brief settle
  }
  await hideOverlays(page);
}

/**
 * Helper to select Rider App from the dev swapper if present.
 */
export async function selectRiderApp(page: Page) {
  const riderBtn = page.locator('#rider-app-btn');
  const returnBtn = page.getByRole('button', { name: /Return to Rider App/i }).first();

  await expect(riderBtn.or(returnBtn).first()).toBeVisible({ timeout: 60_000 });

  if (await riderBtn.isVisible()) {
    await riderBtn.click({ force: true });
  } else if (await returnBtn.isVisible()) {
    await returnBtn.click({ force: true });
  }

  await page
    .locator(':text("Verifying authorization..."), .animate-spin')
    .first()
    .waitFor({ state: 'detached', timeout: 5_000 })
    .catch(() => {});
}

/**
 * Hides fixed UI overlays (dev swapper, floating buttons) that block clicks.
 */
export async function hideOverlays(page: Page) {
  // Use a very aggressive selector to catch the dev swapper and any modals
  const css = `
    #dev-swapper,
    .fixed.bottom-20,
    [data-radix-portal],
    [role="dialog"],
    .fixed.inset-0.z-50,
    div.fixed.top-2.right-2,
    div.fixed.bottom-2.right-2 {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    .pointer-events-none {
      pointer-events: auto !important;
    }
    body {
      pointer-events: auto !important;
      overflow: auto !important;
    }
  `;
  await page.addStyleTag({ content: css });

  // Also inject it via init script for future navigations/reloads
  await page.addInitScript((cssContent) => {
    const style = document.createElement('style');
    style.innerHTML = cssContent;
    document.head.appendChild(style);
  }, css);
}

/**
 * Full session restore using addInitScript — the canonical way to start
 * a test as a logged-in rider with a specific state profile.
 *
 * Prefer loginAsRiderWithSession for new tests.
 */
export async function restoreRiderSession(page: Page, riderData: any) {
  const phone = (riderData.phone || '9876543210').replace('+91', '');
  const name = riderData.fullName || riderData.name || 'Test Rider';
  const id = riderData.id || 'rider_test';

  await page.addInitScript(
    ({ id, name, phone, riderData }) => {
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
              ...riderData,
              registrationDone: true,
              kycDone: true,
              depositDone: true,
              planDone: true,
              pickupDone: true,
              accountStatus: 'ACTIVE',
            },
            otpVerified: true,
            permissionsAccepted: true,
            legalAccepted: true,
          },
          version: 0,
        })
      );
    },
    { id, name, phone, riderData }
  );

  await page.goto('/');
  await selectRiderApp(page);

  // ✅ Same fix: .or() then .first() to avoid strict-mode violation
  const walletCard = page.getByTestId('wallet-card');
  const fallback = page.getByText(/Dashboard Overview|Available Balance|Wallet Balance/i);
  await expect(walletCard.or(fallback).first()).toBeVisible({ timeout: 60_000 });
  await hideOverlays(page);
}

/**
 * Locator for the rider app container (useful for scoping in cross-app tests).
 */
export const riderContainer = (page: Page) => page.locator('.max-w-md.mx-auto').first();

/**
 * Post-load state injection via page.evaluate() — use this for SUBSEQUENT
 * state updates within the SAME test after the initial restoreRiderSession()
 * or loginAsRiderWithSession() call.
 *
 * Unlike addInitScript (which accumulates), evaluate() runs synchronously in
 * the current page context and is safe to call multiple times per test.
 */
export async function reinjectRiderState(page: Page, riderData: any) {
  const id = riderData.id || 'rider_test';
  const name = riderData.fullName || riderData.name || 'Test Rider';

  // Update localStorage directly (will take effect on next page reload)
  await page.evaluate(
    ({ id, name, riderData }) => {
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
            screen: riderData.screen || 'active_dashboard',
            rider: {
              ...riderData,
              registrationDone: true,
              kycDone: true,
              depositDone: true,
              planDone: true,
              pickupDone: true,
              accountStatus: riderData.accountStatus || 'ACTIVE',
            },
            otpVerified: true,
            permissionsAccepted: true,
            legalAccepted: true,
          },
          version: 0,
        })
      );

      // Also push to live Zustand store if available
      try {
        const store = (window as any).useAppStore?.getState();
        const session = (window as any).useRiderSession?.getState();
        if (session) session.setRiderSession(id, name);
        if (store) {
          store.setRider({
            ...riderData,
            registrationDone: true,
            kycDone: true,
            depositDone: true,
            planDone: true,
            pickupDone: true,
          });
          store.setScreen(riderData.screen || 'active_dashboard');
        }
      } catch (_) {}
    },
    { id, name, riderData }
  );
}
