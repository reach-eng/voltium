import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Admin Panel Browser Review', () => {
  const artifactDir = 'C:\\Users\\reach\\.gemini\\antigravity\\brain\\8a1a6ea7-c97d-4e03-9a82-ee851230f739';
  const screenshotsDir = path.join(artifactDir, 'browser-review');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Comprehensive review of http://localhost:8081', async ({ page }) => {
    test.setTimeout(60000);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const networkFailures: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        networkFailures.push(`${res.status()} ${res.url()}`);
      }
    });

    // Step 1: Login
    await loginAsAdmin(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, '01_admin_dashboard.png'), fullPage: true });

    // Step 2: Riders Management
    const ridersNav = page.locator('[data-nav-id="riders"]');
    if (await ridersNav.count() > 0) {
      await ridersNav.first().scrollIntoViewIfNeeded();
      await ridersNav.first().click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotsDir, '02_riders_management.png'), fullPage: true });

      const viewDetailsBtn = page.locator('button[title="View Details"]').first();
      if (await viewDetailsBtn.count() > 0 && await viewDetailsBtn.isVisible()) {
        await viewDetailsBtn.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(screenshotsDir, '03_rider_detail_modal.png'), fullPage: true });

        const phoneAccessTab = page.locator('button[value="device"], [role="tab"]:has-text("Phone Access")');
        if (await phoneAccessTab.count() > 0) {
          await phoneAccessTab.first().click();
          await page.waitForTimeout(2500);
          await page.screenshot({ path: path.join(screenshotsDir, '04_rider_phone_access_tab.png'), fullPage: true });
        }

        const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Close")');
        if (await closeBtn.count() > 0) {
          await closeBtn.first().click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // Step 3: Standalone Device Tracking
    const deviceTrackingNav = page.locator('[data-nav-id="device-tracking"]');
    if (await deviceTrackingNav.count() > 0) {
      await deviceTrackingNav.first().scrollIntoViewIfNeeded();
      await deviceTrackingNav.first().click({ force: true });
      await page.waitForTimeout(3000);
      
      const riderSelectTrigger = page.locator('button:has-text("Choose a rider"), [role="combobox"]');
      if (await riderSelectTrigger.count() > 0 && await riderSelectTrigger.first().isVisible()) {
        await riderSelectTrigger.first().click();
        await page.waitForTimeout(1000);
        const firstRiderOption = page.locator('[role="option"], [data-slot="select-item"]').first();
        if (await firstRiderOption.count() > 0) {
          await firstRiderOption.click();
          await page.waitForTimeout(3000);
        }
      }
      
      await page.screenshot({ path: path.join(screenshotsDir, '05_standalone_device_tracking.png'), fullPage: true });
    }

    // Step 4: Rider Scoring
    const scoringNav = page.locator('[data-nav-id="rider-scoring"]');
    if (await scoringNav.count() > 0) {
      await scoringNav.first().scrollIntoViewIfNeeded();
      await scoringNav.first().click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotsDir, '06_rider_scoring.png'), fullPage: true });
    }

    // Step 5: Onboarding / KYC
    const kycNav = page.locator('[data-nav-id="kyc"]');
    if (await kycNav.count() > 0) {
      await kycNav.first().scrollIntoViewIfNeeded();
      await kycNav.first().click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotsDir, '08_kyc_management.png'), fullPage: true });
    }

    // Step 6: Theme Toggle (Dark Mode)
    const themeBtn = page.locator('button:has(svg.lucide-sun), button:has(svg.lucide-moon), button[aria-label*="theme" i]');
    if (await themeBtn.count() > 0) {
      await themeBtn.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '07_dark_mode_review.png'), fullPage: true });
    }

    console.log('=== BROWSER REVIEW METRICS ===');
    console.log('Console Errors:', consoleErrors);
    console.log('Page Errors:', pageErrors);
    console.log('Network Failures:', networkFailures);
  });
});
