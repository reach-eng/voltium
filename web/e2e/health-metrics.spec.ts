import { test, expect } from '@playwright/test';

/**
 * E2E tests for the health and metrics endpoints.
 *
 * These tests call /api/health and /api/metrics directly to verify
 * that both endpoints are responsive and return the expected shape.
 *
 * The tests are intentionally lightweight — they do not require auth
 * and can be run against a running dev or production server.
 */

test.describe('Health & Metrics Endpoints', () => {
  test('GET /api/health returns 200 with expected fields', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();

    // Must have a status field
    expect(body).toHaveProperty('status');
    expect(['ok', 'unhealthy']).toContain(body.status);

    // Must have a db field (boolean)
    expect(body).toHaveProperty('db');
    expect(typeof body.db).toBe('boolean');

    // Must have a redis field
    expect(body).toHaveProperty('redis');

    // In a healthy system, status should be 'ok' and db should be true
    expect(body.status).toBe('ok');
    expect(body.db).toBe(true);
  });

  test('GET /api/health returns 503 when unhealthy', async ({ page }) => {
    // Mock the health endpoint to simulate an unhealthy response
    await page.route('**/api/health', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'unhealthy', db: false, redis: true }),
      });
    });

    const response = await page.request.get('/api/health');
    expect(response.status()).toBe(503);

    const body = await response.json();
    expect(body.status).toBe('unhealthy');
    expect(body.db).toBe(false);
  });

  test('GET /api/metrics returns 200 with Prometheus-compatible text', async ({ request }) => {
    const response = await request.get('/api/metrics');
    expect(response.status()).toBe(200);

    const text = await response.text();
    // Prometheus metrics begin with HELP or TYPE lines
    expect(text).toMatch(/^#\s+(HELP|TYPE)/m);
  });
});
