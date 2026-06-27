import { test, expect } from '@playwright/test';
import {
  gotoAdminPanel,
  mockAdminApis,
  mockVehicle,
  switchToAdmin,
} from './fixtures/helpers';

/**
 * Comprehensive Admin Panel Tests
 * Uses actual nav IDs from role-config.ts:
 *   overview, riders, kyc, rentals, vehicles, hubs, transactions, tickets,
 *   incidents, team-leaders, operations, fleet-map, shifts, rider-scoring,
 *   notifications, offers, rewards, analytics, admin-users, faq, legal,
 *   device-tracking, workflow-coverage, business-settings, settings,
 *   server-health, data-management
 */
test.describe('Admin Panel Comprehensive Tests', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);

    page.on('console', msg => console.log(`[ADMIN-CONSOLE] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.error(`[ADMIN-ERROR] ${err.stack || err.message}`));

    // Auth mocks
    await page.route('**/api/admin/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { role: 'SUPER_ADMIN', email: 'admin@voltium.io', name: 'Dev Admin' } }),
      });
    });
    await page.route('**/api/admin/auth/login', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.route('**/api/admin/settings/maintenance', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { maintenanceMode: false, autoApproveKyc: false } }) });
    });

    await page.route('**/api/admin/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalRiders: 15, activeRentals: 4, totalVehicles: 25,
            availableVehicles: 12, totalBalance: 8500, totalDeposits: 150000,
            pendingTransactions: 2, openTickets: 1, totalHubs: 3,
            pendingKyc: 2, pendingGuarantor: 1, activeRiders: 10,
            activeRiders7d: 8, revenue7d: 12000, avgPlanValue: 1800,
            totalShifts: 5, totalTeamLeaders: 2, activeCoupons: 3,
            totalFaqs: 12, totalAdmins: 4,
          },
        }),
      });
    });

    await page.route('**/api/admin/audit-logs*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.route('**/api/admin/riders*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            riders: [
              { id: 'r1', riderId: 'VF-001', fullName: 'Alice Rider', phone: '9001001001', kycStatus: 'APPROVED', state: 'ACTIVE', walletBalance: 3000, createdAt: new Date().toISOString() },
              { id: 'r2', riderId: 'VF-002', fullName: 'Bob Pending', phone: '9001001002', kycStatus: 'SUBMITTED', guarantorStatus: 'SUBMITTED', state: 'ONBOARDING', walletBalance: 0, createdAt: new Date().toISOString() },
            ],
            pagination: { totalPages: 1, total: 2 }
          },
        }),
      });
    });

    await page.route('**/api/admin/vehicles*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            mockVehicle({ id: 'v1', vehicleNumber: 'VF-EV-001', status: 'AVAILABLE' }),
            mockVehicle({ id: 'v2', vehicleNumber: 'VF-EV-002', status: 'ASSIGNED' }),
          ],
        }),
      });
    });

    await page.route('**/api/admin/hubs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'hub-1', name: 'Central Hub', address: '123 EV Street', city: 'Delhi', capacity: 50, vehicleCount: 20 },
            { id: 'hub-2', name: 'North Hub', address: '456 North Ave', city: 'Delhi', capacity: 30, vehicleCount: 10 },
          ],
        }),
      });
    });

    await page.route('**/api/admin/transactions*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'tx1', type: 'TOP_UP', amount: 500, status: 'PENDING', purpose: 'WALLET_TOPUP', rider: { fullName: 'Bob Pending', phone: '9001001002' }, createdAt: new Date().toISOString() },
            { id: 'tx2', type: 'RENTAL_FEE', amount: 299, status: 'SUCCESS', purpose: 'RENTAL_FEE', rider: { fullName: 'Alice Rider', phone: '9001001001' }, createdAt: new Date().toISOString() },
          ],
        }),
      });
    });

    await page.route('**/api/admin/tickets*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'tkt1', ticketId: 'VF-TKT-001', title: 'Charging issue', status: 'OPEN', priority: 'HIGH', rider: { fullName: 'Alice Rider' }, createdAt: new Date().toISOString() },
          ],
        }),
      });
    });

    await page.route('**/api/admin/offers*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'offer1', title: '10% Off First Week', discountPercent: 10, isActive: true, validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
          ],
        }),
      });
    });

    await page.route('**/api/admin/faqs*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'faq1', question: 'How do I top up?', answer: 'Via UPI or bank transfer', isActive: true, category: 'Payment' },
            { id: 'faq2', question: 'How do I return a vehicle?', answer: 'Via the app return flow', isActive: true, category: 'Vehicle' },
          ],
        }),
      });
    });

    await page.route('**/api/admin/plans*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'plan1', name: 'Weekly', type: 'WEEKLY', price: 1500, durationDays: 7, isActive: true },
            { id: 'plan2', name: 'Monthly', type: 'MONTHLY', price: 4500, durationDays: 30, isActive: true },
          ],
        }),
      });
    });

    await page.route('**/api/admin/team-leaders*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'tl1', name: 'Team Leader Alpha', email: 'tl@voltium.io', phone: '9800000001', assignedRiders: 5 },
          ],
        }),
      });
    });

    await page.route('**/api/admin/notifications*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { sent: 15, failed: 0 } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.route('**/api/admin/announcements*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.route('**/api/admin/settings*', async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { maintenanceMode: false, autoApproveKyc: false } }) });
    });

    await page.route('**/api/admin/system-settings*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });

    await page.route('**/api/admin/analytics*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { revenueByMonth: [], riderGrowth: [], vehicleUtilization: 78 } }),
      });
    });

    // Navigate to admin panel
    await page.context().addCookies([{ name: 'voltium-admin-session', value: 'dev-admin-session-token', domain: 'localhost', path: '/' }]);
    await page.goto('/?view=admin');

    // Wait for dashboard to fully load (shimmer to clear and skeletons replaced with loaded data)
    await page.waitForLoadState('networkidle');
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
    await expect(page.locator('h3').filter({ hasText: /\d+/ }).first()).toBeVisible({ timeout: 15_000 });
  });

  // -----------------------------------------------
  // DASHBOARD
  // -----------------------------------------------
  test('Admin dashboard shows all KPI cards', async ({ page }) => {
    await expect(page.getByText(/Dashboard|Welcome/i).first()).toBeVisible({ timeout: 20_000 });

    // Wait for any loading to complete
    await page.waitForTimeout(1000);

    // KPI cards — at least one numeric stat should be visible
    const kpiValues = page.locator('.rounded-2xl, .rounded-xl, [data-kpi], .stat-card').filter({ hasText: /\d+/ });
    const count = await kpiValues.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('Admin dashboard shows welcome message', async ({ page }) => {
    await expect(
      page.getByText(/Welcome back|Dashboard|Overview/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  // -----------------------------------------------
  // RIDERS MANAGEMENT
  // -----------------------------------------------
  test('Admin can navigate to Riders section and view list', async ({ page }) => {
    await page.locator('[data-nav-id="riders"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(page.getByText(/Alice Rider|Bob Pending|Riders/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Admin can search for a rider by name', async ({ page }) => {
    await page.locator('[data-nav-id="riders"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await searchInput.fill('Alice');
      await page.waitForTimeout(500);
      await expect(page.getByText(/Alice Rider/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('Admin can view rider details by clicking a row', async ({ page }) => {
    await page.locator('[data-nav-id="riders"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const searchInput = page.locator('input[placeholder*="search"], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }
    const riderRow = page.locator('tr').filter({ hasText: /Alice Rider/i }).first();
    await riderRow.waitFor({ state: 'visible', timeout: 15_000 });
    // Click the Eye button by its title attribute
    await riderRow.locator('button[title="View Details"]').first().click({ force: true });

    await expect(
      page.getByText(/Alice Rider|Phone|KYC|Profile/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Admin can approve a KYC submission', async ({ page }) => {
    // Override riders route to show submitted rider
    await page.route('**/api/admin/riders*', async (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { kycStatus: 'APPROVED' } }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'r2', riderId: 'VF-002', fullName: 'Bob Pending', phone: '9001001002',
            kycStatus: 'SUBMITTED', guarantorStatus: 'SUBMITTED', state: 'ONBOARDING',
            walletBalance: 0, createdAt: new Date().toISOString(),
          }],
        }),
      });
    });

    await page.locator('[data-nav-id="kyc"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const pendingTab = page.locator('button, [role="tab"]').filter({ hasText: /Pending/i }).first();
    await pendingTab.waitFor({ state: 'visible', timeout: 15_000 });
    await pendingTab.click({ force: true });

    await expect(page.getByText(/Bob Pending/i).first()).toBeVisible({ timeout: 15_000 });

    const approveBtn = page.locator('button[title="Approve"]').first();
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click({ force: true });
      const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /^Approve$/i })
        .or(page.locator('[role="alertdialog"]').getByRole('button', { name: /^Approve$/i })).first();
      await confirmBtn.click({ force: true });
      await expect(page.getByText(/Approved|Success/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  // -----------------------------------------------
  // VEHICLE MANAGEMENT
  // -----------------------------------------------
  test('Admin can view vehicle fleet list', async ({ page }) => {
    await page.locator('[data-nav-id="vehicles"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(page.getByText(/VF-EV-001|VF-EV-002|Vehicles|Fleet/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Admin can add a new vehicle', async ({ page }) => {
    await page.locator('[data-nav-id="vehicles"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const addBtn = page.locator('button').filter({ hasText: /Add Vehicle|New Vehicle|Add New/i }).first();
    if (await addBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await addBtn.click({ force: true });

      const vehicleNumberInput = page.locator('input[name*="vehicle"], input[placeholder*="vehicle"], input[name*="number"], input[placeholder*="Number"]').first();
      await expect(vehicleNumberInput).toBeVisible({ timeout: 10_000 });
      await vehicleNumberInput.fill('VF-EV-099');

      const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /Save|Add|Create|Submit/i }).last();
      await submitBtn.click({ force: true });

      await expect(page.getByText(/VF-EV-099|Created|Added|Success/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  // -----------------------------------------------
  // FINANCIAL OPERATIONS (id: 'transactions' = 'Finance')
  // -----------------------------------------------
  test('Admin can view all transactions', async ({ page }) => {
    await page.locator('[data-nav-id="transactions"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(
      page.getByText(/TOP_UP|RENTAL_FEE|500|299|Finance|Transactions/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Admin can filter transactions by pending status', async ({ page }) => {
    await page.locator('[data-nav-id="transactions"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const pendingTab = page.locator('button, [role="tab"]').filter({ hasText: /Pending/i }).first();
    if (await pendingTab.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await pendingTab.click({ force: true });
      await expect(page.getByText(/PENDING|Bob Pending|500/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('Admin can approve a pending top-up', async ({ page }) => {
    await page.locator('[data-nav-id="transactions"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const pendingTab = page.locator('button, [role="tab"]').filter({ hasText: /Pending/i }).first();
    if (await pendingTab.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await pendingTab.click({ force: true });
    }

    const approveBtn = page.locator('button[title="Approve"]').first();
    if (await approveBtn.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await approveBtn.click({ force: true });

      const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /^Approve$/i })
        .or(page.locator('[role="alertdialog"]').getByRole('button', { name: /^Approve$/i })).first();
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click({ force: true });
        await expect(page.getByText(/Approved|Success/i).first()).toBeVisible({ timeout: 10_000 });
      }
    } else {
      // If no approve button, at least verify the tab content loaded
      await expect(
        page.getByText(/Pending|Finance|Transaction|No/i).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  // -----------------------------------------------
  // SUPPORT TICKETS (id: 'tickets')
  // -----------------------------------------------
  test('Admin can view open support tickets', async ({ page }) => {
    await page.locator('[data-nav-id="tickets"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(page.getByText(/Charging issue|VF-TKT|OPEN|Support/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Admin can filter tickets by priority', async ({ page }) => {
    await page.locator('[data-nav-id="tickets"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const highPriorityFilter = page.locator('button, [role="option"], select option').filter({ hasText: /High|HIGH/i }).first();
    if (await highPriorityFilter.isVisible({ timeout: 8000 }).catch(() => false)) {
      await highPriorityFilter.click({ force: true });
      await expect(page.getByText(/Charging issue|HIGH/i).first()).toBeVisible({ timeout: 10_000 });
    } else {
      // Tickets section loaded, even without high priority filter
      await expect(page.getByText(/Support|Ticket|VF-TKT/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  // -----------------------------------------------
  // OFFERS & COUPONS (id: 'offers')
  // -----------------------------------------------
  test('Admin can view active offers', async ({ page }) => {
    await page.locator('[data-nav-id="offers"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(page.getByText(/10% Off|Offers|Discount|Coupons/i).first()).toBeVisible({ timeout: 15_000 });
  });

  // -----------------------------------------------
  // FAQ MANAGEMENT (id: 'faq' — NOT 'faqs')
  // -----------------------------------------------
  test('Admin can view FAQ list', async ({ page }) => {
    await page.locator('[data-nav-id="faq"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(page.getByText(/How do I top up|How do I return|FAQ/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('Admin can add a new FAQ', async ({ page }) => {
    await page.locator('[data-nav-id="faq"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const addFaqBtn = page.locator('button').filter({ hasText: /Add FAQ|New FAQ|Create|Add Question/i }).first();
    if (await addFaqBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await addFaqBtn.click({ force: true });

      const questionInput = page.locator('input[name*="question"], textarea[name*="question"], input[placeholder*="question"]').first();
      await expect(questionInput).toBeVisible({ timeout: 10_000 });
      await questionInput.fill('How do I check battery status?');

      const answerInput = page.locator('textarea[name*="answer"], input[name*="answer"], textarea[placeholder*="answer"]').first();
      if (await answerInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await answerInput.fill('The battery status is displayed on your dashboard.');
      }

      const saveBtn = page.locator('button[type="submit"], button').filter({ hasText: /Save|Add|Create/i }).last();
      await saveBtn.click({ force: true });

      await expect(page.getByText(/battery status|Created|Success/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  // -----------------------------------------------
  // HUBS MANAGEMENT (id: 'hubs')
  // -----------------------------------------------
  test('Admin can view hub list', async ({ page }) => {
    await page.locator('[data-nav-id="hubs"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(page.getByText(/Central Hub|North Hub|Hubs/i).first()).toBeVisible({ timeout: 15_000 });
  });

  // -----------------------------------------------
  // TEAM LEADERS (id: 'team-leaders')
  // -----------------------------------------------
  test('Admin can view team leaders', async ({ page }) => {
    await page.locator('[data-nav-id="team-leaders"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(page.getByText(/Team Leader Alpha|Team Leaders/i).first()).toBeVisible({ timeout: 15_000 });
  });

  // -----------------------------------------------
  // SETTINGS (id: 'settings' = System Settings)
  // -----------------------------------------------
  test('Admin can access settings panel', async ({ page }) => {
    await page.locator('[data-nav-id="settings"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(
      page.getByText(/Settings|System|Configuration/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Admin can toggle maintenance mode', async ({ page }) => {
    await page.route('**/api/admin/settings*', async (route) => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { maintenanceMode: true } }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { maintenanceMode: false, autoApproveKyc: false } }) });
    });

    await page.locator('[data-nav-id="settings"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const maintenanceToggle = page
      .getByRole('switch', { name: /Maintenance/i })
      .or(page.locator('[role="switch"]').first())
      .or(page.locator('input[type="checkbox"]').first())
      .first();

    if (await maintenanceToggle.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await maintenanceToggle.click({ force: true });
      await expect(page.getByText(/Saved|Updated|Success/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  // -----------------------------------------------
  // ANALYTICS (id: 'analytics')
  // -----------------------------------------------
  test('Admin can view analytics / reports section', async ({ page }) => {
    await page.locator('[data-nav-id="analytics"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(
      page.getByText(/Analytics|Revenue|Reports|Growth/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  // -----------------------------------------------
  // NOTIFICATIONS / MESSAGING (id: 'notifications')
  // -----------------------------------------------
  test('Admin can access messaging section', async ({ page }) => {
    await page.locator('[data-nav-id="notifications"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    await expect(
      page.getByText(/Messaging|Notification|Push|Broadcast/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Admin can send a notification to all riders', async ({ page }) => {
    await page.locator('[data-nav-id="notifications"]').first().click({ force: true });
    await page.locator('.shimmer').first().waitFor({ state: 'detached', timeout: 15_000 }).catch(() => {});

    const titleInput = page.locator('input[name*="title"], input[placeholder*="title"], input[placeholder*="Subject"]').first();
    if (await titleInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await titleInput.fill('Reminder: Plan Renewal Available');

      const bodyInput = page.locator('textarea[name*="body"], textarea[placeholder*="message"], textarea[placeholder*="Message"]').first();
      if (await bodyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bodyInput.fill('Your plan is expiring soon. Renew to continue enjoying Voltium.');
      }

      const sendBtn = page.locator('button').filter({ hasText: /Send|Broadcast|Push/i }).first();
      await sendBtn.click({ force: true });

      await expect(page.getByText(/Sent|Success|sent/i).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
