import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Onboarding & KYC Management Deep Review', () => {
  const screenshotsDir = 'C:\\Users\\reach\\.gemini\\antigravity\\brain\\8a1a6ea7-c97d-4e03-9a82-ee851230f739\\browser-review\\kyc';

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Comprehensive Interactive Review of Onboarding & KYC Section', async ({ page }) => {
    test.setTimeout(90000);

    // Step 1: Login & Navigate to Onboarding / KYC
    await loginAsAdmin(page);
    await page.waitForTimeout(2000);

    const kycNav = page.locator('[data-nav-id="kyc"]');
    await kycNav.first().scrollIntoViewIfNeeded();
    await kycNav.first().click({ force: true });
    await page.waitForTimeout(3000);

    // Step 2: Pending KYC filter
    const pendingChip = page.locator('button:has-text("Pending"), [role="tab"]:has-text("Pending")').first();
    if (await pendingChip.count() > 0) {
      await pendingChip.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '01_kyc_pending_filter.png'), fullPage: true });
    }

    // Step 3: Submitted KYC filter
    const submittedChip = page.locator('button:has-text("Submitted"), [role="tab"]:has-text("Submitted")').first();
    if (await submittedChip.count() > 0) {
      await submittedChip.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '02_kyc_submitted_filter.png'), fullPage: true });
    }

    // Step 4: Approved KYC filter
    const approvedChip = page.locator('button:has-text("Approved"), [role="tab"]:has-text("Approved")').first();
    if (await approvedChip.count() > 0) {
      await approvedChip.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '03_kyc_approved_filter.png'), fullPage: true });
    }

    // Step 5: All KYC filter
    const allChip = page.locator('button:has-text("All"), [role="tab"]:has-text("All")').first();
    if (await allChip.count() > 0) {
      await allChip.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '04_kyc_all_filter.png'), fullPage: true });
    }

    // Step 6: Multi-Row Selection & Bulk Bar
    const checkboxes = page.locator('table tbody tr button[role="checkbox"]');
    if (await checkboxes.count() >= 2) {
      await checkboxes.nth(0).click({ force: true });
      await checkboxes.nth(1).click({ force: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '05_kyc_bulk_bar.png'), fullPage: true });

      // Deselect
      await checkboxes.nth(0).click({ force: true });
      await checkboxes.nth(1).click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Step 7: Open KYC Review Detail Sheet
    const eyeBtn = page.locator('table tbody tr button:has(svg.lucide-eye)').first();
    if (await eyeBtn.count() > 0) {
      await eyeBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotsDir, '06_kyc_review_detail_sheet.png'), fullPage: true });

      // Close Sheet
      const closeSheet = page.locator('button[aria-label="Close"], button:has-text("Close")').first();
      if (await closeSheet.count() > 0) {
        await closeSheet.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // Step 8: Test Approve Dialog
    const approveActionBtn = page.locator('table tbody tr button[title="Approve"]').first();
    if (await approveActionBtn.count() > 0) {
      await approveActionBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '07_kyc_approve_dialog.png'), fullPage: true });

      const cancelDialog = page.locator('button:has-text("Cancel")').first();
      if (await cancelDialog.count() > 0) {
        await cancelDialog.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // Step 9: Test Needs Correction Dialog
    const correctionBtn = page.locator('table tbody tr button[title="Needs Correction"]').first();
    if (await correctionBtn.count() > 0) {
      await correctionBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '08_kyc_correction_dialog.png'), fullPage: true });

      const cancelDialog = page.locator('button:has-text("Cancel")').first();
      if (await cancelDialog.count() > 0) {
        await cancelDialog.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // Step 10: Theme Toggle (Dark Mode)
    const themeBtn = page.locator('button:has(svg.lucide-sun), button:has(svg.lucide-moon), button[aria-label*="theme" i]');
    if (await themeBtn.count() > 0) {
      await themeBtn.first().click({ force: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '09_kyc_dark_mode.png'), fullPage: true });
    }
  });
});
