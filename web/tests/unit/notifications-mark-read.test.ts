import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  requireRiderSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: mocks.requireRiderSession,
}));
vi.mock('@/server/modules/notifications/notification.use-cases', () => ({
  notificationUseCases: {
    markRead: mocks.markRead,
    markAllRead: mocks.markAllRead,
  },
}));

import { PUT } from '@/app/api/rider/notifications/route';

describe('Notification Mark-Read PUT API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls markRead when notificationId is provided in body', async () => {
    mocks.requireRiderSession.mockResolvedValue({ id: 'r_1', riderDbId: 'r_db_1' });
    mocks.markRead.mockResolvedValue({ success: true });

    const req = new NextRequest('http://localhost/api/rider/notifications', {
      method: 'PUT',
      body: JSON.stringify({ notificationId: 'notif_123' }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mocks.markRead).toHaveBeenCalledWith('notif_123', 'r_db_1');
    expect(mocks.markAllRead).not.toHaveBeenCalled();
  });

  it('calls markAllRead when notificationId is omitted from body', async () => {
    mocks.requireRiderSession.mockResolvedValue({ id: 'r_1', riderDbId: 'r_db_1' });
    mocks.markAllRead.mockResolvedValue({ success: true });

    const req = new NextRequest('http://localhost/api/rider/notifications', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mocks.markAllRead).toHaveBeenCalledWith('r_db_1');
    expect(mocks.markRead).not.toHaveBeenCalled();
  });
});
