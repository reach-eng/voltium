/**
 * P0-1/P0-9 (2026-08-05 ops audit) — notifications broadcast hardening.
 *
 * The route used to call sendToAllRiders synchronously with no rate limit and
 * no confirmation — a single admin could DoS the DB with 2-3 calls inserting
 * 100k rows each. Fixes:
 *   - ?confirm=true is required for sendToAll
 *   - rate limit: 3/hr per admin, fail-closed
 *   - emits NOTIFICATION_BROADCAST to the outbox and returns 202 instead of
 *     holding the request open for ~30-60s of inserts
 *
 * Test gaps TG-1 + TG-2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  emit: vi.fn(),
  sendToSingleRider: vi.fn(),
  sendToSpecificRiders: vi.fn(),
  sendToAllRiders: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));

vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));

// Use the REAL rate limiter (memory store in tests) so TG-2 proves the
// 3/hr/admin cap actually holds, not just that a mocked function is called.
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return { ...actual };
});

vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: mocks.emit },
  OutboxEventTypes: { NOTIFICATION_BROADCAST: 'notification.broadcast' },
}));

vi.mock('@/server/modules/notifications/notification.use-cases', () => ({
  notificationUseCases: {
    sendToSingleRider: mocks.sendToSingleRider,
    sendToSpecificRiders: mocks.sendToSpecificRiders,
    sendToAllRiders: mocks.sendToAllRiders,
  },
}));

import { clearRateLimitStore } from '@/lib/rate-limit';
import { POST } from '@/app/api/admin/notifications/route';

function makeRequest(body: Record<string, unknown>, confirm?: string): NextRequest {
  const url = new URL('http://localhost/api/admin/notifications');
  if (confirm) url.searchParams.set('confirm', confirm);
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });
}

const VALID_BODY = {
  title: 'System maintenance',
  message: 'Scheduled maintenance tonight at 2 AM.',
  type: 'ALERT',
  sendToAll: true,
};

function mockSession(overrides: Record<string, unknown> = {}) {
  mocks.requireAdmin.mockResolvedValue({
    adminId: 'admin_broadcast_1',
    adminRole: 'OPERATIONS_ADMIN',
    ...overrides,
  });
  mocks.hasPermission.mockReturnValue(true);
  mocks.emit.mockResolvedValue('evt_123');
}

describe('P0-1/P0-9: broadcast requires confirmation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearRateLimitStore();
    mockSession();
  });

  it('rejects sendToAll without ?confirm=true', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(JSON.stringify(json)).toContain('confirm');
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it('accepts sendToAll with ?confirm=true and returns 202', async () => {
    const res = await POST(makeRequest(VALID_BODY, 'true'));
    expect(res.status).toBe(202);
    expect(mocks.emit).toHaveBeenCalledWith('notification.broadcast', {
      title: 'System maintenance',
      message: 'Scheduled maintenance tonight at 2 AM.',
      type: 'ALERT',
      adminId: 'admin_broadcast_1',
    });
    const json = await res.json();
    // success() wraps the payload in { success, data, ... }.
    expect((json.data as { accepted: boolean }).accepted).toBe(true);
    expect((json.data as { eventId: string }).eventId).toBe('evt_123');
  });
});

describe('P0-1/P0-9: broadcast rate limit (3/hr per admin)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearRateLimitStore();
    mockSession();
  });

  it('allows 3 broadcasts then 429s on the 4th', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await POST(makeRequest(VALID_BODY, 'true'));
      expect(res.status).toBe(202);
    }
    const blocked = await POST(makeRequest(VALID_BODY, 'true'));
    expect(blocked.status).toBe(429);
  });

  it('rate limit is per-admin, not global', async () => {
    // First admin uses all 3 slots
    for (let i = 0; i < 3; i++) {
      expect((await POST(makeRequest(VALID_BODY, 'true'))).status).toBe(202);
    }
    // A different admin is unaffected
    mockSession({ adminId: 'admin_broadcast_2' });
    expect((await POST(makeRequest(VALID_BODY, 'true'))).status).toBe(202);
  });

  it('single-rider sends are NOT rate-limited; specific-rider sends are async (P3-10)', async () => {
    mocks.sendToSingleRider.mockResolvedValue({ id: 'n1' });
    mocks.sendToSpecificRiders.mockResolvedValue({ count: 2 });
    const single = await POST(
      makeRequest({ title: 'Hi rider', message: 'Your vehicle is ready.', riderId: 'rider_1' })
    );
    expect(single.status).toBe(201);
    expect(mocks.sendToSingleRider).toHaveBeenCalledWith(
      'rider_1',
      'Hi rider',
      'Your vehicle is ready.',
      'INFO',
      'admin_broadcast_1'
    );
    // P3-10: the specific-riders branch now goes through the outbox (same
    // event type as broadcast; the job branches on riderIds) — 202, not 201.
    const batch = await POST(
      makeRequest({
        title: 'Hi rider',
        message: 'Your vehicle is ready.',
        riderIds: ['rider_1', 'rider_2'],
      })
    );
    expect(batch.status).toBe(202);
    expect(mocks.emit).toHaveBeenCalledWith('notification.broadcast', {
      title: 'Hi rider',
      message: 'Your vehicle is ready.',
      type: 'INFO',
      adminId: 'admin_broadcast_1',
      riderIds: ['rider_1', 'rider_2'],
    });
    expect(mocks.sendToSpecificRiders).not.toHaveBeenCalled();
  });

  it('P1-14: a non-existent rider returns 404, not 500', async () => {
    mocks.sendToSingleRider.mockRejectedValue(new Error('Rider not found'));
    const res = await POST(
      makeRequest({ title: 'Hi rider', message: 'Your vehicle is ready.', riderId: 'ghost_rider' })
    );
    expect(res.status).toBe(404);
  });

  it('P1-13: riderId is schema-validated — a non-string value returns 422', async () => {
    const res = await POST(
      makeRequest({ title: 'Hi rider', message: 'Your vehicle is ready.', riderId: 12345 })
    );
    expect(res.status).toBe(422);
    expect(mocks.sendToSingleRider).not.toHaveBeenCalled();
  });
});
