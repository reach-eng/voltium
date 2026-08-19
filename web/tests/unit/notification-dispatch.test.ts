import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks must be declared before importing the job under test.
const mockNotifyKycStatusChange = vi.fn().mockResolvedValue({ success: true });
const mockNotifySupportReply = vi.fn().mockResolvedValue({ success: true });
const mockNotifyRewardMilestone = vi.fn().mockResolvedValue({ success: true });
const mockNotifyShiftReminder = vi.fn().mockResolvedValue({ success: true });
const mockSendOverlayTrigger = vi.fn().mockResolvedValue({ success: true });

vi.mock('@/lib/notification-service', () => ({
  notificationService: {
    notifyKycStatusChange: (...args: unknown[]) =>
      mockNotifyKycStatusChange(...args),
    notifySupportReply: (...args: unknown[]) =>
      mockNotifySupportReply(...args),
    notifyRewardMilestone: (...args: unknown[]) =>
      mockNotifyRewardMilestone(...args),
    notifyShiftReminder: (...args: unknown[]) =>
      mockNotifyShiftReminder(...args),
  },
}));

vi.mock('@/lib/fcm', () => ({
  fcmService: {
    sendOverlayTrigger: (...args: unknown[]) =>
      mockSendOverlayTrigger(...args),
  },
}));

const mockRider = { id: 'rider-1', fcmToken: 'fcm-token-abc' };
vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn().mockImplementation(async ({ where }) => {
        if (where.id === 'rider-1') return mockRider;
        if (where.id === 'rider-no-token') {
          return { id: 'rider-no-token', fcmToken: null };
        }
        return null;
      }),
    },
  },
}));

import { notificationDispatchJob } from '@/server/workers/jobs/notification-dispatch.job';

describe('notificationDispatchJob (BLOCKER 1.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches KYC_APPROVED to notifyKycStatusChange', async () => {
    const result = await notificationDispatchJob.process({
      id: 'job-1',
      payload: { type: 'KYC_APPROVED', riderId: 'rider-1' },
    });
    expect(result.delivered).toBe(true);
    // The dispatcher now also persists the in-app Notification row — the
    // honest channel is fcm+in-app (the FCM push is the primary path).
    expect(result.channel).toBe('fcm+in-app');
    expect(mockNotifyKycStatusChange).toHaveBeenCalledWith(
      'rider-1',
      'APPROVED'
    );
  });

  it('dispatches KYC_REJECTED with reason', async () => {
    const result = await notificationDispatchJob.process({
      id: 'job-2',
      payload: {
        type: 'KYC_REJECTED',
        riderId: 'rider-1',
        reason: 'blurry Aadhaar',
      },
    });
    expect(result.delivered).toBe(true);
    expect(mockNotifyKycStatusChange).toHaveBeenCalledWith(
      'rider-1',
      'REJECTED',
      'blurry Aadhaar'
    );
  });

  it('dispatches SUPPORT_REPLY with ticketId and subject', async () => {
    await notificationDispatchJob.process({
      id: 'job-3',
      payload: {
        type: 'SUPPORT_REPLY',
        riderId: 'rider-1',
        ticketId: 'TKT-42',
        subject: 'Cannot log in',
      },
    });
    expect(mockNotifySupportReply).toHaveBeenCalledWith(
      'rider-1',
      'TKT-42',
      'Cannot log in'
    );
  });

  it('dispatches MANDATORY_UPDATE via raw FCM overlay', async () => {
    const result = await notificationDispatchJob.process({
      id: 'job-4',
      payload: {
        type: 'MANDATORY_UPDATE',
        riderId: 'rider-1',
        url: 'https://play.google.com/store/apps/details?id=...',
      },
    });
    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('overlay');
    expect(mockSendOverlayTrigger).toHaveBeenCalledWith(
      'fcm-token-abc',
      'MANDATORY_UPDATE',
      { url: expect.stringContaining('play.google.com') }
    );
  });

  it('dispatches WALLET_LOW with balance', async () => {
    await notificationDispatchJob.process({
      id: 'job-5',
      payload: { type: 'WALLET_LOW', riderId: 'rider-1', balance: 50 },
    });
    expect(mockSendOverlayTrigger).toHaveBeenCalledWith(
      'fcm-token-abc',
      'WALLET_LOW',
      { balance: '50' }
    );
  });

  it('returns warning when rider has no FCM token (overlay case)', async () => {
    const result = await notificationDispatchJob.process({
      id: 'job-6',
      payload: { type: 'WALLET_LOW', riderId: 'rider-no-token', balance: 0 },
    });
    expect(result.delivered).toBe(false);
    expect(result.warning).toBe('no FCM token');
    expect(mockSendOverlayTrigger).not.toHaveBeenCalled();
  });

  it('returns warning for unknown payload type without throwing', async () => {
    const result = await notificationDispatchJob.process({
      id: 'job-7',
      payload: { type: 'FUTURE_THING', riderId: 'rider-1' },
    });
    expect(result.delivered).toBe(false);
    expect(result.warning).toBe('unknown type');
  });

  it('returns warning for malformed payload (no type or no riderId)', async () => {
    const r1 = await notificationDispatchJob.process({
      id: 'j',
      payload: { type: 'KYC_APPROVED' },
    });
    const r2 = await notificationDispatchJob.process({
      id: 'j',
      payload: { riderId: 'rider-1' },
    });
    expect(r1.warning).toBe('malformed payload');
    expect(r2.warning).toBe('malformed payload');
  });
});
