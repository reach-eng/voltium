import { test, expect } from '@playwright/test';

/**
 * E2E tests for the admin backup flow.
 *
 * These tests verify that:
 *   1. A manual backup can be triggered via the API.
 *   2. The backup job reaches COMPLETED status within a reasonable timeout.
 *   3. The completed backup can be downloaded as a valid ZIP file.
 *
 * Prerequisites:
 *   - The dev server must be running with admin credentials set.
 *   - ENABLE_DEV_ADMIN_LOGIN=true (dev/test environment).
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';

async function getAdminCookie(request: Parameters<typeof test>[1] extends { request: infer R } ? R : never) {
  // Log in as dev admin to get a session cookie
  const res = await (request as any).post(`${BASE}/api/auth/dev-admin-login`, {
    data: { secret: process.env.DEV_ADMIN_SECRET ?? 'dev-secret' },
  });
  return res.headers()['set-cookie'] ?? '';
}

test.describe('Backup Flow', () => {
  test('trigger manual backup and verify download', async ({ request }) => {
    test.setTimeout(120_000);

    // Step 1 – Trigger a manual backup
    const triggerRes = await request.post(`${BASE}/api/admin/data-management/backups`, {
      data: { type: 'MANUAL', label: 'e2e-test-backup' },
      headers: { 'Content-Type': 'application/json' },
    });

    // We expect either 200 (created) or 401 (not authenticated — acceptable in CI without creds)
    if (triggerRes.status() === 401) {
      test.skip(true, 'Admin auth not configured in this environment; skipping backup flow test.');
      return;
    }

    expect([200, 201]).toContain(triggerRes.status());

    const { data: job } = await triggerRes.json();
    expect(job).toHaveProperty('id');
    const jobId: string = job.id;

    // Step 2 – Poll until COMPLETED (max 90 s)
    let status = '';
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await request.get(`${BASE}/api/admin/data-management/backups/${jobId}`);
      if (!pollRes.ok()) break;
      const body = await pollRes.json();
      status = body?.data?.status ?? '';
      if (status === 'COMPLETED' || status === 'FAILED') break;
    }

    expect(status).toBe('COMPLETED');

    // Step 3 – Download the backup and verify it is a ZIP
    const dlRes = await request.get(`${BASE}/api/admin/data-management/backups/${jobId}/download`);
    expect(dlRes.status()).toBe(200);

    const contentType = dlRes.headers()['content-type'] ?? '';
    expect(contentType).toMatch(/zip|octet-stream/i);

    const buffer = await dlRes.body();
    // ZIP magic bytes: PK (0x50 0x4B)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  test('backup list returns array', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/data-management/backups`);

    if (res.status() === 401) {
      test.skip(true, 'Admin auth not configured; skipping.');
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
