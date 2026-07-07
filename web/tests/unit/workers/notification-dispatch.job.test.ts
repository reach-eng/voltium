import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationDispatchJob } from '../../../src/server/workers/jobs/notification-dispatch.job';
import { notificationService } from '../../../src/lib/notification-service';
import { fcmService } from '../../../src/lib/fcm';
import { testDb } from '../../_setup/test-postgres';
import { v4 as uuidv4 } from 'uuid';

vi.mock('../../../src/lib/notification-service', () => ({
  notificationService: {
    notifyKycStatusChange: vi.fn(),
    notifySupportReply: vi.fn(),
    notifyRewardMilestone: vi.fn(),
    notifyShiftReminder: vi.fn(),
  },
}));

vi.mock('../../../src/lib/fcm', () => ({
  fcmService: {
    sendOverlayTrigger: vi.fn(() => Promise.resolve()),
  },
}));

describe('Notification Dispatch Job', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('should skip malformed payload', async () => {
    const result = await notificationDispatchJob.process({ id: '1', payload: {} });
    expect(result.delivered).toBe(false);
    expect(result.warning).toBe('malformed payload');
  });

  it('should dispatch KYC_APPROVED to notificationService', async () => {
    const riderId = uuidv4();
    const result = await notificationDispatchJob.process({
      id: '2',
      payload: { type: 'KYC_APPROVED', riderId },
    });

    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('fcm');
    expect(notificationService.notifyKycStatusChange).toHaveBeenCalledWith(riderId, 'APPROVED');
  });

  it('should dispatch SUPPORT_REPLY to notificationService', async () => {
    const riderId = uuidv4();
    const result = await notificationDispatchJob.process({
      id: '3',
      payload: { type: 'SUPPORT_REPLY', riderId, ticketId: 'T1', subject: 'Help' },
    });

    expect(result.delivered).toBe(true);
    expect(notificationService.notifySupportReply).toHaveBeenCalledWith(riderId, 'T1', 'Help');
  });

  it('should return channel none for unknown types', async () => {
    const riderId = uuidv4();
    const result = await notificationDispatchJob.process({
      id: '4',
      payload: { type: 'UNKNOWN_MAGIC_TYPE', riderId },
    });

    expect(result.delivered).toBe(false);
    expect(result.warning).toBe('unknown type');
  });

  it('should send overlay trigger for MANDATORY_UPDATE if rider has FCM token', async () => {
    const riderId = uuidv4();
    await testDb.rider.create({
      data: {
        id: riderId,
        riderId: uuidv4(),
        referralCode: uuidv4().slice(0, 8),
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        fcmToken: 'token123',
      },
    });

    const result = await notificationDispatchJob.process({
      id: '5',
      payload: { type: 'MANDATORY_UPDATE', riderId, url: 'http://update' },
    });

    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('overlay');
    expect(fcmService.sendOverlayTrigger).toHaveBeenCalledWith('token123', 'MANDATORY_UPDATE', { url: 'http://update' });
  });

  it('should fail to send overlay trigger if FCM token is missing', async () => {
    const riderId = uuidv4();
    await testDb.rider.create({
      data: {
        id: riderId,
        riderId: uuidv4(),
        referralCode: uuidv4().slice(0, 8),
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        fcmToken: null,
      },
    });

    const result = await notificationDispatchJob.process({
      id: '6',
      payload: { type: 'MANDATORY_UPDATE', riderId, url: 'http://update' },
    });

    expect(result.delivered).toBe(false);
    expect(result.warning).toBe('no FCM token');
  });
});
