import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockSendPush = vi.fn().mockResolvedValue({ success: true, messageId: 'msg-stage-c' });
  const mockCreateNotification = vi.fn().mockResolvedValue({ id: 'notif-stage-c' });
  const mockRider = { id: 'rider-stage-c', fcmToken: 'fcm-token-c-xyz' };

  return {
    mockSendPush,
    mockCreateNotification,
    mockRider,
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
        if (where.id === 'rider-stage-c') return mocks.mockRider;
        return null;
      }),
    },
    notification: {
      create: (...args: unknown[]) => mocks.mockCreateNotification(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/posthog-client', () => ({
  posthog: {
    capture: vi.fn(),
  },
}));

import { notificationService } from '@/lib/notification-service';

describe('P1-4 Stage C: notifyRewardMilestone, notifyBirthdayWish, and notifyShiftReminder structured FCM payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyRewardMilestone', () => {
    it('sends empty title and message to FCM to suppress OS English toast, passing REWARD discriminator payload', async () => {
      await notificationService.notifyRewardMilestone('rider-stage-c', 250, 'Silver Fleet Champion');

      expect(mocks.mockSendPush).toHaveBeenCalledWith(
        'fcm-token-c-xyz',
        '',
        '',
        expect.objectContaining({
          screen: 'REWARDS',
          type: 'REWARD',
          points: '250',
          milestoneTitle: 'Silver Fleet Champion',
        })
      );

      expect(mocks.mockCreateNotification).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riderId: 'rider-stage-c',
          title: 'Reward Earned! 🏆',
          type: 'PROMOTION',
        }),
      });
    });

    it('handles empty milestone title gracefully in payload', async () => {
      await notificationService.notifyRewardMilestone('rider-stage-c', 100, '');

      expect(mocks.mockSendPush).toHaveBeenCalledWith(
        'fcm-token-c-xyz',
        '',
        '',
        expect.objectContaining({
          screen: 'REWARDS',
          type: 'REWARD',
          points: '100',
          milestoneTitle: '',
        })
      );
    });
  });

  describe('notifyBirthdayWish', () => {
    it('sends empty title and message to FCM, passing BIRTHDAY_WISH discriminator payload', async () => {
      await notificationService.notifyBirthdayWish('rider-stage-c', 'Vikram');

      expect(mocks.mockSendPush).toHaveBeenCalledWith(
        'fcm-token-c-xyz',
        '',
        '',
        expect.objectContaining({
          screen: 'HOME',
          type: 'BIRTHDAY_WISH',
          name: 'Vikram',
          triggerOverlay: 'BIRTHDAY_WISH',
        })
      );

      expect(mocks.mockCreateNotification).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riderId: 'rider-stage-c',
          title: 'Birthday Wish 🎂',
          type: 'BIRTHDAY_WISH',
        }),
      });
    });

    it('handles empty name gracefully in payload', async () => {
      await notificationService.notifyBirthdayWish('rider-stage-c', '');

      expect(mocks.mockSendPush).toHaveBeenCalledWith(
        'fcm-token-c-xyz',
        '',
        '',
        expect.objectContaining({
          screen: 'HOME',
          type: 'BIRTHDAY_WISH',
          name: '',
          triggerOverlay: 'BIRTHDAY_WISH',
        })
      );
    });
  });

  describe('notifyShiftReminder', () => {
    it('sends empty title and message to FCM, passing SHIFT_REMINDER discriminator payload', async () => {
      await notificationService.notifyShiftReminder('rider-stage-c', '09:00 AM');

      expect(mocks.mockSendPush).toHaveBeenCalledWith(
        'fcm-token-c-xyz',
        '',
        '',
        expect.objectContaining({
          screen: 'SHIFT',
          type: 'SHIFT_REMINDER',
          startTime: '09:00 AM',
        })
      );

      expect(mocks.mockCreateNotification).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riderId: 'rider-stage-c',
          title: 'Upcoming Shift ⏰',
          type: 'SYSTEM',
        }),
      });
    });

    it('handles empty startTime gracefully in payload', async () => {
      await notificationService.notifyShiftReminder('rider-stage-c', '');

      expect(mocks.mockSendPush).toHaveBeenCalledWith(
        'fcm-token-c-xyz',
        '',
        '',
        expect.objectContaining({
          screen: 'SHIFT',
          type: 'SHIFT_REMINDER',
          startTime: '',
        })
      );
    });
  });
});
