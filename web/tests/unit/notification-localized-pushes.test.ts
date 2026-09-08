import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockSendPush = vi.fn().mockResolvedValue({ success: true, messageId: 'msg-123' });
  const mockCreateNotification = vi.fn().mockResolvedValue({ id: 'notif-1' });
  const mockRider = { id: 'rider-1', fcmToken: 'fcm-token-xyz' };

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
        if (where.id === 'rider-1') return mocks.mockRider;
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

describe('P1-4 Stage A: notifySupportReply and notifyPaymentReminder structured FCM payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifySupportReply sends empty title/message to FCM and passes structured discriminator', async () => {
    await notificationService.notifySupportReply('rider-1', 'TICK-402', 'Brakes issue');

    // 1. Verifies FCM call passes empty title and message so OS notification is suppressed
    expect(mocks.mockSendPush).toHaveBeenCalledWith(
      'fcm-token-xyz',
      '',
      '',
      expect.objectContaining({
        screen: 'SUPPORT_TICKET',
        type: 'SUPPORT_REPLY',
        ticketId: 'TICK-402',
        subject: 'Brakes issue',
      })
    );

    // 2. Verifies DB record still gets a human-readable title for in-app inbox
    expect(mocks.mockCreateNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        title: 'Support Ticket Update 💬',
        type: 'INFO',
      }),
    });
  });

  it('notifyPaymentReminder passes integer amountPaise and suppresses OS notification', async () => {
    await notificationService.notifyPaymentReminder('rider-1', 150000, '2026-09-15');

    // 1. Verifies FCM call passes empty title and message + amountPaise
    expect(mocks.mockSendPush).toHaveBeenCalledWith(
      'fcm-token-xyz',
      '',
      '',
      expect.objectContaining({
        screen: 'WALLET',
        type: 'PAYMENT_DUE',
        amountPaise: '150000',
        dueDate: '2026-09-15',
      })
    );

    // 2. Verifies DB record gets default Payment Reminder title
    expect(mocks.mockCreateNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        title: 'Payment Reminder 💳',
        type: 'PAYMENT',
      }),
    });
  });
});
