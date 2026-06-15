import { test, expect } from '@playwright/test';
import fs from 'fs';

test('dump onboarding html', async ({ page }) => {
  await page.goto('http://localhost:8081/#/onboarding');
  await page.waitForTimeout(5000);
  const html = await page.content();
  fs.writeFileSync('onboarding_dump.html', html);
});
