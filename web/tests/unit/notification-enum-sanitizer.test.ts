import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  sendPushNotification: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    notification: { create: mocks.create },
    rider: { findUnique: mocks.findUnique },
  },
}));

vi.mock('@/lib/fcm', () => ({
  fcmService: { sendPushNotification: mocks.sendPushNotification },
}));

import { notificationService } from '@/lib/notification-service';

describe('Notification Service Type Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'n_1' });
    mocks.findUnique.mockResolvedValue({ fcmToken: 'fcm_123' });
    mocks.sendPushNotification.mockResolvedValue({ success: true });
  });

  it('sanitizes custom business types to valid Prisma NotificationType enum values', async () => {
    await notificationService.notifyKycStatusChange('r_1', 'APPROVED');
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SYSTEM',
        }),
      })
    );
  });
});
