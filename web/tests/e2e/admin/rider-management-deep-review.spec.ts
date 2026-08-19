import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Rider Management Deep Review', () => {
  const screenshotsDir = 'C:\\Users\\reach\\.gemini\\antigravity\\brain\\8a1a6ea7-c97d-4e03-9a82-ee851230f739\\browser-review\\riders';

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Interactive Walkthrough of Rider Management Section', async ({ page }) => {
    test.setTimeout(90000);

    // Step 1: Login and navigate to Riders section
    await loginAsAdmin(page);
    await page.waitForTimeout(2000);

    const ridersNav = page.locator('[data-nav-id="riders"]');
    await ridersNav.first().scrollIntoViewIfNeeded();
    await ridersNav.first().click({ force: true });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: path.join(screenshotsDir, '01_riders_main_table.png'), fullPage: true });

    // Step 2: Search filter testing
    const searchInput = page.locator('input[placeholder*="Search by name" i]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('Manish');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '02_search_filtered.png'), fullPage: true });

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(1000);
    }

    // Step 3: KYC filter chip testing
    const approvedChip = page.locator('button:has-text("APPROVED"), [role="tab"]:has-text("APPROVED")').first();
    if (await approvedChip.count() > 0) {
      await approvedChip.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '03_kyc_approved_filter.png'), fullPage: true });

      const allChip = page.locator('button:has-text("ALL"), [role="tab"]:has-text("ALL")').first();
      if (await allChip.count() > 0) {
        await allChip.click();
        await page.waitForTimeout(1000);
      }
    }

    // Step 4: Row selection and Bulk Actions Bar
    const checkboxes = page.locator('table tbody tr button[role="checkbox"]');
    if (await checkboxes.count() >= 2) {
      await checkboxes.nth(0).click({ force: true });
      await checkboxes.nth(1).click({ force: true });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '04_bulk_actions_bar.png'), fullPage: true });

      // Deselect
      await checkboxes.nth(0).click({ force: true });
      await checkboxes.nth(1).click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Step 5: Open Rider Details Modal
    const viewDetailsBtn = page.locator('button[title="View Details"]').first();
    if (await viewDetailsBtn.count() > 0) {
      await viewDetailsBtn.click({ force: true });
      await page.waitForTimeout(2500);

      // Tab 1: Personal Info
      await page.screenshot({ path: path.join(screenshotsDir, '05_modal_personal_info_tab.png'), fullPage: true });

      // Tab 2: ID Photos / KYC Docs
      const kycTab = page.locator('button[value="kyc"], [role="tab"]:has-text("ID Photos")');
      if (await kycTab.count() > 0) {
        await kycTab.first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(screenshotsDir, '06_modal_id_photos_tab.png'), fullPage: true });
      }

      // Tab 3: Guarantor Details
      const guarantorTab = page.locator('button[value="guarantor"], [role="tab"]:has-text("Guarantor Details")');
      if (await guarantorTab.count() > 0) {
        await guarantorTab.first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(screenshotsDir, '07_modal_guarantor_tab.png'), fullPage: true });
      }

      // Tab 4: Vehicle Handover
      const handoverTab = page.locator('button[value="inspection"], [role="tab"]:has-text("Vehicle Handover")');
      if (await handoverTab.count() > 0) {
        await handoverTab.first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(screenshotsDir, '08_modal_vehicle_handover_tab.png'), fullPage: true });
      }

      // Tab 5: Account Steps
      const journeyTab = page.locator('button[value="journey"], [role="tab"]:has-text("Account Steps")');
      if (await journeyTab.count() > 0) {
        await journeyTab.first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(screenshotsDir, '09_modal_account_steps_tab.png'), fullPage: true });
      }

      // Tab 6: Money
      const moneyTab = page.locator('button[value="money"], [role="tab"]:has-text("Money")');
      if (await moneyTab.count() > 0) {
        await moneyTab.first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(screenshotsDir, '10_modal_money_tab.png'), fullPage: true });
      }

      // Tab 7: Phone Access
      const phoneTab = page.locator('button[value="device"], [role="tab"]:has-text("Phone Access")');
      if (await phoneTab.count() > 0) {
        await phoneTab.first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(screenshotsDir, '11_modal_phone_access_tab.png'), fullPage: true });
      }

      // Tab 8: Work Details
      const workTab = page.locator('button[value="ops"], [role="tab"]:has-text("Work Details")');
      if (await workTab.count() > 0) {
        await workTab.first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(screenshotsDir, '12_modal_work_details_tab.png'), fullPage: true });
      }

      // Test "Unlock to Edit"
      const unlockBtn = page.locator('button:has-text("Unlock to Edit")');
      if (await unlockBtn.count() > 0) {
        await unlockBtn.first().click({ force: true });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(screenshotsDir, '13_modal_edit_mode_unlocked.png'), fullPage: true });

        const cancelEditBtn = page.locator('button:has-text("Editing Active")');
        if (await cancelEditBtn.count() > 0) {
          await cancelEditBtn.first().click({ force: true });
          await page.waitForTimeout(1000);
        }
      }

      // Close modal
      const closeBtn = page.locator('button:has-text("CLOSE"), button[aria-label="Close"]').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // Step 6: Add Rider Dialog
    const addRiderBtn = page.locator('button:has-text("Add Rider")');
    if (await addRiderBtn.count() > 0) {
      await addRiderBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '14_add_rider_dialog.png'), fullPage: true });

      const closeAddRider = page.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
      if (await closeAddRider.count() > 0) {
        await closeAddRider.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});
