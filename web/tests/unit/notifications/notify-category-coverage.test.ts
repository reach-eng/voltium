import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from '@/lib/notification-service';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    notification: {
      create: vi.fn(),
    },
    rider: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/fcm', () => ({
  fcmService: {
    sendPushNotification: vi.fn().mockResolvedValue({ success: true }),
    sendOverlayTrigger: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('notificationService method category coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.rider.findUnique as any).mockResolvedValue({ fcmToken: 'test-token' });
    (db.notification.create as any).mockResolvedValue({ id: 'notif-1' });
  });

  it('notifyKycStatusChange sets category to KYC', async () => {
    await notificationService.notifyKycStatusChange('rider-1', 'APPROVED');
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        type: 'SYSTEM',
        category: 'KYC',
      }),
    });
  });

  it('notifySupportReply sets category to SYSTEM', async () => {
    await notificationService.notifySupportReply('rider-1', 'ticket-1', 'Payment query');
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        type: 'INFO',
        category: 'SYSTEM',
      }),
    });
  });

  it('notifyPaymentReminder sets category to PAYMENT', async () => {
    await notificationService.notifyPaymentReminder('rider-1', 50000, 'proactive_24h');
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        type: 'PAYMENT',
        category: 'PAYMENT',
      }),
    });
  });

  it('notifyRewardMilestone sets category to ANNOUNCEMENT', async () => {
    await notificationService.notifyRewardMilestone('rider-1', 100, '100 Rides');
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        type: 'PROMOTION',
        category: 'ANNOUNCEMENT',
      }),
    });
  });

  it('notifyBirthdayWish sets category to ANNOUNCEMENT', async () => {
    await notificationService.notifyBirthdayWish('rider-1', 'Rahul');
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        type: 'BIRTHDAY_WISH',
        category: 'ANNOUNCEMENT',
      }),
    });
  });

  it('notifyShiftReminder sets category to SYSTEM', async () => {
    await notificationService.notifyShiftReminder('rider-1', '09:00 AM');
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        type: 'SYSTEM',
        category: 'SYSTEM',
      }),
    });
  });
});