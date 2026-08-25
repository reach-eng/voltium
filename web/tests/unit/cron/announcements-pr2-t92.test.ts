/**
 * T-92 (PR-2, 2026-08-23) — regression test for the
 * announcements cron auth fix. The previous inline check was
 * `if (process.env.CRON_SECRET && authHeader !== ...)` which
 * fails OPEN when CRON_SECRET is unset. The other 3 cron
 * routes use `requireCronAuth` (fail-closed, >=16-char
 * secret). Announcements was the lone drift.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.8.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const processScheduledAnnouncementsMock = vi.fn();
vi.mock('@/server/modules/announcements/announcement.use-cases', () => ({
  announcementUseCases: {
    processScheduledAnnouncements: (...args: unknown[]) =>
      processScheduledAnnouncementsMock(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('T-92 announcements cron uses requireCronAuth (fail-closed)', () => {
  let originalSecret: string | undefined;
  beforeEach(() => {
    originalSecret = process.env.CRON_SECRET;
    processScheduledAnnouncementsMock.mockReset();
  });
  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('rejects when CRON_SECRET is unset (fail-closed, 503 misconfigured)', async () => {
    // T-92: the previous code's `if (process.env.CRON_SECRET &&
    // ...)` allowed unauthenticated calls when the secret was
    // missing. requireCronAuth returns 503 (not 401) when the
    // route is misconfigured — the cron surface is intentionally
    // unreachable until the secret is set to a >=16-char value.
    delete process.env.CRON_SECRET;
    const { GET } = await import('@/app/api/cron/announcements/route');
    const req = new Request('http://localhost/api/cron/announcements', {
      method: 'GET',
    });
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(503);
    expect(processScheduledAnnouncementsMock).not.toHaveBeenCalled();
  });

  it('rejects when CRON_SECRET is too short (503 misconfigured)', async () => {
    // The requireCronAuth helper rejects short secrets. The
    // previous inline check would have accepted any string.
    process.env.CRON_SECRET = 'short';
    const { GET } = await import('@/app/api/cron/announcements/route');
    const req = new Request('http://localhost/api/cron/announcements', {
      method: 'GET',
    });
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(503);
    expect(processScheduledAnnouncementsMock).not.toHaveBeenCalled();
  });

  it('rejects when bearer is missing or wrong', async () => {
    process.env.CRON_SECRET = 'a-very-long-cron-secret-1234567890';
    const { GET } = await import('@/app/api/cron/announcements/route');
    const req = new Request('http://localhost/api/cron/announcements', {
      method: 'GET',
    });
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
    expect(processScheduledAnnouncementsMock).not.toHaveBeenCalled();
  });

  it('accepts when bearer matches the secret', async () => {
    process.env.CRON_SECRET = 'a-very-long-cron-secret-1234567890';
    processScheduledAnnouncementsMock.mockResolvedValue({
      processedCount: 3,
    });
    const { GET } = await import('@/app/api/cron/announcements/route');
    const req = new Request('http://localhost/api/cron/announcements', {
      method: 'GET',
      headers: {
        authorization: 'Bearer a-very-long-cron-secret-1234567890',
      },
    });
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    expect(processScheduledAnnouncementsMock).toHaveBeenCalledTimes(1);
  });
});
