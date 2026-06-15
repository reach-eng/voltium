import { test, expect } from '@playwright/test';
import { selectRiderApp } from './fixtures/helpers';

test.describe('Rewards System Flow', () => {
  const phoneReferrer = '9991112222';
  const refCode = 'VFR-REWD1';
  const pointsAwarded = 500;

  test('rider earns points through referral and verifies in rewards screen', async ({ page }) => {
    test.setTimeout(150000);
    let rewardPoints = 0;
    // --- 1. MOCK RIDER PROFILE & REWARDS ---
    // Mock current rider (referrer)
    await page.context().route('**/api/rider/profile*', (r) => {
      return r.fulfill({
        body: JSON.stringify({
          success: true,
          data: {
            id: 'referrer-id',
            riderId: 'VF-RD-REFR',
            fullName: 'John Referrer',
            referralCode: refCode,
            paymentStreak: 3,
            totalRewardPoints: rewardPoints,
          },
        }),
      });
    });

    // Mock rewards list
    await page.context().route('**/api/rider/rewards*', (r) => {
      return r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            rewards:
              rewardPoints > 0
                ? [
                    {
                      id: 'rev-1',
                      title: 'Successful Referral',
                      points: pointsAwarded,
                      createdAt: new Date().toISOString(),
                    },
                  ]
                : [],
            totalPoints: rewardPoints,
            thisMonthPoints: rewardPoints,
            currentStreak: 3,
          },
        }),
      });
    });

    // --- 2. GOTO RIDER APP ---
    // Inject session before code runs
    await page.addInitScript(() => {
      const sessionData = {
        state: {
          riderId: 'referrer-id',
          riderName: 'John Referrer',
        },
        version: 0,
      };
      window.localStorage.setItem('voltium-rider-session', JSON.stringify(sessionData));
    });

    await page.goto('http://localhost:8081');
    await page.waitForLoadState('networkidle');

    // Switch to Rider mode
    await selectRiderApp(page);

    // Navigate internally
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('rewards');
    });

    // Verify initial state (0 points)
    await expect(page.getByText(/VoltRewards/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/0 pts/i).first()).toBeVisible();

    // --- 3. SIMULATE REFERRAL ---
    rewardPoints = pointsAwarded;

    // Trigger a reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    await selectRiderApp(page);
    await page.evaluate(() => {
      (window as any).useAppStore.getState().setScreen('rewards');
    });

    // Verify points awarded
    await expect(page.getByText(`${pointsAwarded} pts`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Successful Referral/i)).toBeVisible();
    await expect(page.getByText(/\+500 points/i)).toBeVisible();
    await expect(page.getByText(/\+500 points/i)).toBeVisible();
  });

  test('admin can view the rewards statistics', async ({ page }) => {
    // Mock Admin Session
    await page.route(
      (url) => url.pathname.includes('/api/admin/auth/me'),
      (r) =>
        r.fulfill({
          body: JSON.stringify({ success: true, data: { id: 'admin-1', role: 'SUPER_ADMIN' } }),
        })
    );

    // Mock Rewards fetch
    await page.route(
      (url) => url.pathname.includes('/api/admin/rewards'),
      (r) =>
        r.fulfill({
          body: JSON.stringify({
            success: true,
            data: {
              rewards: [
                {
                  id: 'r-1',
                  riderName: 'John Referrer',
                  riderId: 'VF-RD-REFR',
                  title: 'Successful Referral',
                  points: 500,
                  createdAt: new Date().toISOString(),
                },
              ],
              summary: {
                totalPoints: 500,
                uniqueRiders: 1,
                thisMonthCount: 1,
                thisMonthPoints: 500,
              },
            },
          }),
        })
    );

    await page.goto('http://localhost:8081/?view=admin');
    await expect(
      page
        .getByText(/Overview/i)
        .or(page.getByText(/Voltium Admin/i))
        .first()
    ).toBeVisible({ timeout: 15000 });

    // Go to rewards section
    await page
      .locator('nav button')
      .filter({ hasText: /^Rewards$/ })
      .click({ force: true });

    // Verify admin stats
    await expect(page.getByText(/500 pts/i).first()).toBeVisible();
    await expect(page.getByText(/John Referrer/i)).toBeVisible();
    await expect(page.getByText(/Successful Referral/i)).toBeVisible();
  });
});
