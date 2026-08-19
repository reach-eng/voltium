/**
 * PR-4 (2026-08-06 fix-plan, 9th audit P0): announcement fanout moved out of
 * the request transaction into the outbox + background job.
 *
 * Gates:
 *   1. POST /api/admin/announcements with an immediate ALL audience requires
 *      ?confirm=true and returns 202 Accepted (async), not 201.
 *   2. The rate limit (3/hr/admin, fail-closed) rejects a 4th immediate ALL.
 *   3. announcement-broadcast.job re-derives recipients, writes deliveries +
 *      notifications in batches, and flips status to SENT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// vi.mock factories are hoisted above all top-level code, so every value they
// reference must live in vi.hoisted. Static route imports would also run the
// factories before these consts initialize — use dynamic imports in tests.
const hoisted = vi.hoisted(() => {
  const SESSION = {
    riderDbId: 'admin-1',
    adminId: 'admin-1',
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
  };
  return {
    SESSION,
    useCaseCreateMock: vi.fn(),
    rateLimitMock: vi.fn().mockResolvedValue({ allowed: true }),
    emitMock: vi.fn().mockResolvedValue('event_1'),
    dbMock: {} as Record<string, unknown>,
  };
});

const { SESSION, useCaseCreateMock, rateLimitMock, emitMock, dbMock } = hoisted;

vi.mock('@/lib/rbac', () => ({
  requireAdmin: vi.fn().mockResolvedValue(SESSION),
}));
vi.mock('@/lib/auth', () => ({ hasPermission: vi.fn().mockReturnValue(true) }));
vi.mock('@/server/modules/announcements/announcement.use-cases', () => ({
  announcementUseCases: {
    create: useCaseCreateMock,
    list: vi.fn().mockResolvedValue({ announcements: [], pagination: {} }),
  },
}));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: rateLimitMock }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/sanitize', () => ({ sanitizeHtml: (v: string) => v }));
vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: emitMock },
  OutboxEventTypes: { ANNOUNCEMENT_BROADCAST: 'announcement.broadcast' },
}));
vi.mock('@/lib/db', () => ({ db: dbMock }));

describe('POST /api/admin/announcements — PR-4 async broadcast', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ allowed: true });
    useCaseCreateMock.mockResolvedValue({
      id: 'ann_1',
      status: 'SENT',
      totalRecipients: 12000,
      accepted: true,
    });
    ({ POST } = await import('@/app/api/admin/announcements/route'));
  });

  it('rejects an immediate ALL broadcast without ?confirm=true', async () => {
    const req = new NextRequest('http://localhost/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Important update',
        message: 'New scheme live for all riders.',
        channel: 'IN_APP',
        targetAudience: 'ALL',
        targetIds: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(useCaseCreateMock).not.toHaveBeenCalled();
  });

  it('returns 202 Accepted for a confirmed immediate ALL broadcast', async () => {
    const req = new NextRequest('http://localhost/api/admin/announcements?confirm=true', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Important update',
        message: 'New scheme live for all riders.',
        channel: 'IN_APP',
        targetAudience: 'ALL',
        targetIds: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);
    expect(useCaseCreateMock).toHaveBeenCalled();
    expect(rateLimitMock).toHaveBeenCalledWith(
      'admin:announcement:sendAll:admin-1',
      expect.objectContaining({ failClosed: true })
    );
  });

  it('rejects the 4th immediate ALL send per hour per admin', async () => {
    rateLimitMock.mockResolvedValue({ allowed: false });
    const req = new NextRequest('http://localhost/api/admin/announcements?confirm=true', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Spam alert',
        message: 'Fourth broadcast in an hour — should be blocked.',
        channel: 'IN_APP',
        targetAudience: 'ALL',
        targetIds: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(useCaseCreateMock).not.toHaveBeenCalled();
  });

  it('keeps 201 for scheduled announcements (no async fanout)', async () => {
    useCaseCreateMock.mockResolvedValue({
      id: 'ann_2',
      status: 'SCHEDULED',
      totalRecipients: 500,
      accepted: false,
    });
    const req = new NextRequest('http://localhost/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Scheduled note',
        message: 'Goes out tomorrow morning.',
        channel: 'IN_APP',
        targetAudience: 'BY_HUB',
        targetIds: ['hub_1'],
        scheduledAt: '2026-08-10T06:00:00.000Z',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(rateLimitMock).not.toHaveBeenCalled();
  });
});

describe('announcementBroadcastJob — PR-4 background fanout', () => {
  let announcementBroadcastJob: {
    process: (job: { id: string; payload: unknown }) => Promise<{ count: number }>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ announcementBroadcastJob } = await import(
      '@/server/workers/jobs/announcement-broadcast.job'
    ));
  });

  it('re-derives recipients, writes deliveries + notifications, flips to SENT', async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const deliveryCreateMany = vi.fn().mockResolvedValue({ count: 12 });
    const notificationCreateMany = vi.fn().mockResolvedValue({ count: 12 });
    dbMock.announcement = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ann_1',
        title: 'Hello',
        message: 'World',
        channel: 'IN_APP',
        targetAudience: 'ALL',
        targetIds: [],
        status: 'SCHEDULED',
        totalRecipients: 0,
      }),
      update: updateFn,
    };
    dbMock.rider = {
      findMany: vi
        .fn()
        .mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: `r${i}` }))),
    };
    dbMock.announcementDelivery = {
      // No prior delivery rows → all 12 recipients are new.
      findMany: vi.fn().mockResolvedValue([]),
      createMany: deliveryCreateMany,
    };
    dbMock.notification = { createMany: notificationCreateMany };

    const result = await announcementBroadcastJob.process({
      id: 'evt_1',
      payload: { announcementId: 'ann_1' },
    });

    expect(result.count).toBe(12);
    expect(deliveryCreateMany).toHaveBeenCalledTimes(1);
    expect(notificationCreateMany).toHaveBeenCalledTimes(1);
    expect(deliveryCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ann_1' },
        data: expect.objectContaining({ status: 'SENT' }),
      })
    );
  });

  it('does not re-insert deliveries or notifications when every recipient already has a delivery row (fully replayed event)', async () => {
    // The old status===SENT guard was the PR-4 critical bug: immediate sends
    // are created with status SENT before the fanout runs, so the guard
    // skipped the very first fanout. A replayed event now re-derives
    // recipients, subtracts the ones already fanned out, and only inserts
    // the missing ones — no duplicate notification spam on retry.
    const updateFn = vi.fn().mockResolvedValue({});
    const deliveryCreateMany = vi.fn().mockResolvedValue({ count: 0 });
    const notificationCreateMany = vi.fn().mockResolvedValue({ count: 0 });
    const existingRiders = Array.from({ length: 5 }, (_, i) => ({ riderId: `r${i}` }));
    dbMock.announcement = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ann_1',
        title: 'Hello',
        message: 'World',
        channel: 'IN_APP',
        targetAudience: 'ALL',
        targetIds: [],
        status: 'SENT',
        totalRecipients: 5,
      }),
      update: updateFn,
    };
    dbMock.rider = {
      findMany: vi
        .fn()
        .mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` }))),
    };
    dbMock.announcementDelivery = {
      findMany: vi.fn().mockResolvedValue(existingRiders),
      createMany: deliveryCreateMany,
    };
    dbMock.notification = { createMany: notificationCreateMany };

    const result = await announcementBroadcastJob.process({
      id: 'evt_retry',
      payload: { announcementId: 'ann_1' },
    });

    expect(result.count).toBe(5);
    expect(dbMock.rider.findMany).toHaveBeenCalled();
    expect(deliveryCreateMany).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ann_1' },
        data: expect.objectContaining({ status: 'SENT' }),
      })
    );
  });

  it('only inserts the missing riders after a partial run (mid-batch crash retry)', async () => {
    // The reviewer's gap: notification.createMany(skipDuplicates) is a silent
    // no-op without a unique constraint on Notification. This test pins the
    // fix — the job subtracts riders with an existing delivery row, so a
    // partial-run retry only fanned out r2/r3 once.
    const updateFn = vi.fn().mockResolvedValue({});
    const deliveryCreateMany = vi.fn().mockResolvedValue({ count: 3 });
    const notificationCreateMany = vi.fn().mockResolvedValue({ count: 3 });
    dbMock.announcement = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ann_1',
        title: 'Hello',
        message: 'World',
        channel: 'IN_APP',
        targetAudience: 'ALL',
        targetIds: [],
        status: 'SENT',
        totalRecipients: 5,
      }),
      update: updateFn,
    };
    dbMock.rider = {
      findMany: vi
        .fn()
        .mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` }))),
    };
    dbMock.announcementDelivery = {
      // First run delivered r0 + r1, crashed before r2/r3/r4.
      findMany: vi.fn().mockResolvedValue([{ riderId: 'r0' }, { riderId: 'r1' }]),
      createMany: deliveryCreateMany,
    };
    dbMock.notification = { createMany: notificationCreateMany };

    const result = await announcementBroadcastJob.process({
      id: 'evt_partial_retry',
      payload: { announcementId: 'ann_1' },
    });

    expect(result.count).toBe(5);
    expect(deliveryCreateMany).toHaveBeenCalledTimes(1);
    const insertedRiderIds = deliveryCreateMany.mock.calls[0][0].data.map(
      (d: { riderId: string }) => d.riderId
    );
    expect(insertedRiderIds.sort()).toEqual(['r2', 'r3', 'r4']);
    const notifiedRiderIds = notificationCreateMany.mock.calls[0][0].data.map(
      (d: { riderId: string }) => d.riderId
    );
    expect(notifiedRiderIds.sort()).toEqual(['r2', 'r3', 'r4']);
    expect(updateFn).toHaveBeenCalled();
  });

  it('returns 0 and skips fanout when the announcement is missing', async () => {
    dbMock.announcement = { findUnique: vi.fn().mockResolvedValue(null) };

    const result = await announcementBroadcastJob.process({
      id: 'evt_missing',
      payload: { announcementId: 'nope' },
    });

    expect(result.count).toBe(0);
  });
});
