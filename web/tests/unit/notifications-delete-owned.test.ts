import { describe, it, expect, beforeEach, vi } from 'vitest';

// PR-VER-2026-08-06 (SUPPORT_NOTIFICATIONS P0-5): the rider app's
// swipe-to-delete used to be local-only. The server half is DELETE
// /api/rider/notifications?id=..., ownership-scoped via deleteMany.
// This gates the use-case + repository contract.

const mocks = vi.hoisted(() => {
  const deleteMany = vi.fn();
  return { deleteMany };
});

vi.mock('@/lib/db', () => ({
  db: {
    notification: {
      deleteMany: (...args: unknown[]) => mocks.deleteMany(...args),
    },
  },
}));

import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';

describe('notificationUseCases.deleteNotification (P0-5 server half)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the row scoped to the owning rider', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });

    const ok = await notificationUseCases.deleteNotification('ntf_1', 'rider-1');

    expect(ok).toBe(true);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: 'ntf_1', riderId: 'rider-1' },
    });
  });

  it('returns false when the row belongs to another rider', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });

    const ok = await notificationUseCases.deleteNotification('ntf_1', 'rider-2');

    expect(ok).toBe(false);
  });

  it('never deletes by id alone (no cross-rider delete)', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });

    await notificationUseCases.deleteNotification('ntf_1', 'rider-1');

    const arg = mocks.deleteMany.mock.calls[0][0] as {
      where: { id: string; riderId: string };
    };
    expect(arg.where.riderId).toBe('rider-1');
    expect(arg.where.id).toBe('ntf_1');
  });
});
