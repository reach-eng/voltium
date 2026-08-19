import { describe, it, expect, beforeEach, vi } from 'vitest';

// PR-VER-2026-08-06 (SHIFTS P0-4 Bug B): the admin single-rider notification
// route used to only insert the DB row — no FCM push. This test gates the fix
// where sendToSingleRider now fires the push (best-effort).

const mocks = vi.hoisted(() => {
  const mockSendPush = vi.fn().mockResolvedValue({ success: true });
  return {
    mockSendPush,
    mockRider: { id: 'rider-1', fcmToken: 'fcm-token-abc' },
    mockNotification: { id: 'ntf_1', riderId: 'rider-1' },
  };
});

vi.mock('@/lib/fcm', () => ({
  fcmService: {
    sendPushNotification: (...args: unknown[]) => mocks.mockSendPush(...args),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => {
        if (where.id === 'rider-1') return mocks.mockRider;
        if (where.id === 'rider-no-token') {
          return { id: 'rider-no-token', fcmToken: null };
        }
        return null;
      }),
    },
    notification: {
      create: vi.fn().mockResolvedValue(mocks.mockNotification),
    },
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: (key: string, loader: () => unknown) => loader(),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';

describe('sendToSingleRider — FCM push (SHIFTS P0-4 Bug B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSendPush.mockResolvedValue({ success: true });
  });

  it('fires an FCM push when the rider has a token', async () => {
    await notificationUseCases.sendToSingleRider(
      'rider-1',
      'Ride discounted',
      'Use VOLT20 for 20% off',
      'PROMOTION',
      'admin_1'
    );

    expect(mocks.mockSendPush).toHaveBeenCalledWith(
      'fcm-token-abc',
      'Ride discounted',
      'Use VOLT20 for 20% off',
      expect.objectContaining({ screen: 'NOTIFICATIONS' })
    );
  });

  it('does not fire a push when the rider has no token', async () => {
    await notificationUseCases.sendToSingleRider(
      'rider-no-token',
      'Hi',
      'No token here',
      'INFO',
      'admin_1'
    );

    expect(mocks.mockSendPush).not.toHaveBeenCalled();
  });

  it('still creates the DB row and audit log when the push fails', async () => {
    mocks.mockSendPush.mockRejectedValue(new Error('FCM down'));

    await expect(
      notificationUseCases.sendToSingleRider(
        'rider-1',
        'T',
        'Message',
        'INFO',
        'admin_1'
      )
    ).resolves.toEqual(mocks.mockNotification);

    const auditLog = await import('@/lib/audit-log');
    expect(auditLog.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification.send', entityId: 'ntf_1' })
    );
  });
});
