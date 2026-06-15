import { test, expect } from '@playwright/test';
import { loginAsRiderWithSession, switchToAdmin } from './fixtures/helpers';

test.describe('Support Ticket Flow', () => {
  const phone = '9998884444';

  test('create a support ticket and verify in admin panel', async ({ page }) => {
    test.setTimeout(150_000);

    // --- MOCKS ---
    let tickets: any[] = [];
    await page.route('**/api/support/tickets*', (r) => {
      if (r.request().method() === 'POST') {
        const body = JSON.parse(r.request().postData() || '{}');
        tickets.push({
          id: 'ticket-1',
          ticketId: 'VF-TK-001',
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          ...body,
        });
        return r.fulfill({
          body: JSON.stringify({ success: true, message: 'Ticket submitted successfully' }),
        });
      }
      return r.fulfill({ body: JSON.stringify({ success: true, data: { tickets } }) });
    });
    await page.route('**/api/rider/profile*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-rider-support',
            phone,
            fullName: 'Support User',
            kycStatus: 'APPROVED',
            kycDone: true,
            registrationDone: true,
            depositDone: true,
            planDone: true,
            pickupDone: true,
            walletBalance: 2000,
          },
        }),
      })
    );
    await page.route('**/api/rider/dashboard*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            rider: { id: 'test-rider-support', fullName: 'Support User', walletBalance: 2000 },
            unreadNotifications: 0,
            todayStats: {},
            planDaysRemaining: 7,
            referralCode: 'SUP1',
          },
        }),
      })
    );

    // --- 1. RIDER CREATE TICKET (session injection — no OTP needed) ---
    await loginAsRiderWithSession(page, {
      id: 'test-rider-support',
      phone,
      fullName: 'Support User',
      kycStatus: 'APPROVED',
      kycDone: true,
      registrationDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: true,
      walletBalance: 2000,
    });

    await expect(
      page.getByText(/Welcome back|Available Balance|Dashboard Overview/i).first()
    ).toBeVisible({ timeout: 20_000 });

    // Navigate to Support via bottom nav or store
    const supportNavBtn = page
      .locator('button, a')
      .filter({ hasText: /^Support$/ })
      .first();
    if (await supportNavBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await supportNavBtn.click({ force: true });
    } else {
      await page.evaluate(() => {
        (window as any).useAppStore?.getState().setScreen('support');
      });
    }

    // Wait for Support screen — the form is shown inline (no modal)
    await expect(page.getByText(/Support Center|Support|Help/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // The support form is inline — fill the description textarea directly
    const descTextarea = page
      .locator('textarea')
      .filter({ hasText: '' })
      .first()
      .or(page.getByPlaceholder(/Describe the issue|describe/i).first());
    await descTextarea.fill('Battery problem - draining very fast.');

    // Select issue type if a dropdown is present
    const issueDropdown = page.locator('select').first();
    if (await issueDropdown.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await issueDropdown.selectOption({ index: 1 });
    }

    // Click the Raise Ticket / Submit button
    const raiseBtn = page
      .getByRole('button', { name: /Raise Ticket|Submit Ticket|Submit|Send/i })
      .first();
    await expect(raiseBtn).toBeVisible({ timeout: 10_000 });
    await raiseBtn.click({ force: true });

    // Verify success toast / message
    await expect(
      page.getByText(/submitted successfully|Ticket created|Ticket submitted|success/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // --- 2. ADMIN VERIFICATION ---
    // Register admin tickets mock BEFORE switchToAdmin so it exists during page load.
    // switchToAdmin skips 'tickets' so our handler wins.
    await page.route('**/api/admin/tickets*', (r) =>
      r.fulfill({
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'ticket-1',
              ticketId: 'VF-TK-001',
              riderName: 'Support User',
              category: 'VEHICLE',
              priority: 'MEDIUM',
              subject: 'Battery problem',
              message: 'Battery problem - draining very fast.',
              status: 'OPEN',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      })
    );

    await switchToAdmin(page, ['tickets']);

    // Navigate to Support/Tickets section
    await page
      .locator('button')
      .filter({ hasText: /^Tickets$|^Support/ })
      .first()
      .click({ force: true });

    // Verify Ticket is listed
    await expect(page.getByText(/Battery problem/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Support User/).first()).toBeVisible();
  });
});
