import { test, expect } from '@playwright/test';

test('Debug Rider App Load', async ({ page }) => {
  // Block service workers to ensure we load the fresh file from network
  await page.route('**/flutter_service_worker.js', route => route.abort());
  await page.route('**/sw.js', route => route.abort());

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', exception => {
    console.log('PAGE ERROR message:', exception.message);
    console.log('PAGE ERROR stack:', exception.stack);
  });

  console.log('Navigating to /rider-app/index.html...');
  const response = await page.goto('/rider-app/index.html');
  console.log('Status code:', response?.status());

  console.log('Waiting for flt-glasspane to be visible...');
  try {
    await page.waitForSelector('flt-glass-pane', { timeout: 15000 });
    console.log('✅ Success! flt-glass-pane is visible.');
  } catch (e) {
    console.log('❌ Failed to find flt-glass-pane. Page HTML:', await page.evaluate(() => document.body.innerHTML));
  }

  await page.screenshot({ path: 'rider-app-debug-screenshot.png' });
});
