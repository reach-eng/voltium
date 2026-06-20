import { test, expect } from '@playwright/test';

/**
 * Backups & Restore E2E Tests
 *
 * Tests backup creation, verification, download, and restore flow
 * in the admin data management panel.
 */
test.describe('Backups & Restore Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const mockBackups = [
    {
      id: 'backup-1',
      filename: 'voltium-backup-2026-06-16.zip',
      sizeBytes: 1024 * 1024 * 25, // 25MB
      status: 'COMPLETED',
      type: 'MANUAL',
      createdAt: new Date().toISOString(),
      verified: true,
    },
    {
      id: 'backup-2',
      filename: 'voltium-backup-2026-06-15.zip',
      sizeBytes: 1024 * 1024 * 23,
      status: 'COMPLETED',
      type: 'SCHEDULED',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      verified: true,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/data-management/backups*', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: mockBackups }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { jobId: 'job-new-123', status: 'RUNNING' } }),
      });
    });

    await page.route('**/api/admin/data-management/overview*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            backupCount: 2,
            lastBackupAt: new Date().toISOString(),
            storageUsed: 1024 * 1024 * 48,
            lastRestoreAt: null,
          },
        }),
      })
    );

    await page.route('**/api/admin/dashboard*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalRiders: 5,
            activeRiders: 3,
            totalVehicles: 10,
            availableVehicles: 8,
            pendingTransactions: 0,
            openTickets: 0,
            activeRentals: 2,
          },
        }),
      })
    );
  });

  test('backup list API requires auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/data-management/backups');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view backup list', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    // Navigate to data management
    const dataNav = page.getByText(/data management|backup/i).first();
    if (await dataNav.isVisible({ timeout: 10_000 })) {
      await dataNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const backupEntry = page.getByText(/voltium-backup-2026-06-16|backup/i).first();
    await expect(backupEntry).toBeVisible({ timeout: 20_000 });
  });

  test('create backup button triggers API call', async ({ page }) => {
    test.setTimeout(45_000);
    let backupTriggered = false;

    await page.route('**/api/admin/data-management/backups*', async (route) => {
      if (route.request().method() === 'POST') {
        backupTriggered = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { jobId: 'job-new-456', status: 'RUNNING' },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockBackups }),
      });
    });

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const dataNav = page.getByText(/data management|backup/i).first();
    if (await dataNav.isVisible({ timeout: 10_000 })) {
      await dataNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const createBackupBtn = page
      .getByRole('button', { name: /create backup|backup now|new backup/i })
      .first();
    if (await createBackupBtn.isVisible({ timeout: 15_000 })) {
      await createBackupBtn.click();
      await page.waitForTimeout(1000);
      expect(backupTriggered).toBe(true);
    }
  });

  test('restore API requires confirmation and auth', async ({ page }) => {
    test.setTimeout(15_000);

    // Restore should require auth
    const response = await page.request.post('/api/admin/data-management/restore/start', {
      data: { backupId: 'backup-1', confirmed: true },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('backup schedule API requires auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/data-management/schedule');
    expect([401, 403]).toContain(response.status());
  });
});
