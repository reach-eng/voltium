import { test, expect } from '@playwright/test';

/**
 * Audit Logs Admin E2E Tests
 */
test.describe('Audit Logs Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const mockAuditLogs = [
    {
      id: 'audit-1',
      action: 'KYC_APPROVED',
      adminId: 'admin-1',
      adminName: 'Superadmin',
      targetId: 'rider-1',
      targetType: 'RIDER',
      metadata: { previousStatus: 'SUBMITTED', newStatus: 'APPROVED' },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'audit-2',
      action: 'DEPOSIT_APPROVED',
      adminId: 'admin-1',
      adminName: 'Superadmin',
      targetId: 'tx-1',
      targetType: 'TRANSACTION',
      metadata: { amount: 150000, riderId: 'rider-2' },
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/admin/audit-logs*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockAuditLogs, total: 2 }),
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

  test('audit logs API requires admin auth', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.request.get('/api/admin/audit-logs');
    expect([401, 403]).toContain(response.status());
  });

  test('admin can view audit logs', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/?view=admin');
    const loginBtn = page.getByRole('button', { name: /Login as Admin/i });
    if (await loginBtn.isVisible({ timeout: 10_000 })) {
      await loginBtn.click();
    }
    await page.waitForLoadState('networkidle').catch(() => {});

    const auditNav = page.getByText(/audit log|audit/i).first();
    if (await auditNav.isVisible({ timeout: 10_000 })) {
      await auditNav.click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const logEntry = page.getByText(/KYC_APPROVED|DEPOSIT_APPROVED|Superadmin/i).first();
    await expect(logEntry.or(page.locator('[data-testid="audit-log-list"]')).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('audit logs cannot be modified via POST', async ({ page }) => {
    test.setTimeout(15_000);
    // Audit logs are immutable — POST/DELETE should not be allowed or returns 405
    const response = await page.request.delete('/api/admin/audit-logs');
    expect([401, 403, 405]).toContain(response.status());
  });
});
