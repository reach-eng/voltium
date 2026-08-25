import { describe, it, expect, beforeEach, vi } from 'vitest';

// PR-VER-2026-08-06 (SHIFTS P0-4 Bug B — batch path): sendToAllRiders and
// sendToSpecificRiders used to insert DB rows only — riders got in-app
// notifications but NO push. This test gates the fix where both admin batch
// flows now fire FCM multicasts (500/batch, best-effort).

const mocks = vi.hoisted(() => {
  const mockSendMulticast = vi.fn().mockResolvedValue({ successCount: 2 });
  const mockBatchInit = [
    { id: 'rider-1', fcmToken: 'fcm-token-1' },
    { id: 'rider-2', fcmToken: 'fcm-token-2' },
    { id: 'rider-3', fcmToken: null }, // no token — filtered out
  ];
  return {
    mockSendMulticast,
    mockBatch: [...mockBatchInit],
    mockBatchInit,
  };
});

vi.mock('@/lib/fcm', () => ({
  fcmService: {
    sendMulticast: (...args: unknown[]) => mocks.mockSendMulticast(...args),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findMany: vi.fn().mockImplementation(async ({ where, skip = 0 }) => {
        // Broadcast path (sendToAllRiders): pages of riders. The loop
        // terminates when a page comes back empty (skip advances by
        // BATCH_SIZE each iteration).
        if (!where) {
          if (skip > 0) return [];
          return mocks.mockBatch;
        }
        // Specific-riders path: only the requested ids, token select.
        return mocks.mockBatch.filter(
          (r: { id: string; fcmToken: string | null }) =>
            (where.id?.in ?? []).includes(r.id)
        );
      }),
    },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';

describe('sendToAllRiders — FCM multicast (SHIFTS P0-4 Bug B, batch path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSendMulticast.mockResolvedValue({ successCount: 2 });
    mocks.mockBatch.splice(0, mocks.mockBatch.length, ...mocks.mockBatchInit);
  });

  it('fires one FCM multicast with only the valid tokens', async () => {
    await notificationUseCases.sendToAllRiders(
      'Flash sale',
      '50% off everything',
      'PROMOTION',
      'admin_1'
    );

    expect(mocks.mockSendMulticast).toHaveBeenCalledTimes(1);
    expect(mocks.mockSendMulticast).toHaveBeenCalledWith(
      ['fcm-token-1', 'fcm-token-2'],
      expect.objectContaining({ screen: 'NOTIFICATIONS' }),
      'high'
    );
  });

  it('still returns the total count when no rider has a token', async () => {
    const tokenless = [
      { id: 'rider-1', fcmToken: null },
      { id: 'rider-2', fcmToken: null },
    ];
    mocks.mockBatch.splice(0, mocks.mockBatch.length, ...tokenless);

    const result = await notificationUseCases.sendToAllRiders(
      'T',
      'M',
      'INFO',
      'admin_1'
    );

    expect(result.count).toBe(2);
    expect(mocks.mockSendMulticast).not.toHaveBeenCalled();
  });

  it('does not throw when the multicast fails (best-effort)', async () => {
    mocks.mockSendMulticast.mockRejectedValue(new Error('FCM down'));

    await expect(
      notificationUseCases.sendToAllRiders('T', 'M', 'INFO', 'admin_1')
    ).resolves.toEqual({ count: 3, completedSkip: 500 });
  });
});

describe('sendToSpecificRiders — FCM multicast (SHIFTS P0-4 Bug B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSendMulticast.mockResolvedValue({ successCount: 1 });
  });

  it('fires a multicast with the matching riders\' tokens', async () => {
    await notificationUseCases.sendToSpecificRiders(
      ['rider-1', 'rider-2', 'rider-3'],
      'Ride update',
      'Your hub changed',
      'VEHICLE',
      'admin_1'
    );

    expect(mocks.mockSendMulticast).toHaveBeenCalledTimes(1);
    expect(mocks.mockSendMulticast).toHaveBeenCalledWith(
      ['fcm-token-1', 'fcm-token-2'],
      expect.objectContaining({ screen: 'NOTIFICATIONS' }),
      'high'
    );
  });
});
