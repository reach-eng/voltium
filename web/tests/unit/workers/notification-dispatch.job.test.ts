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
    // The dispatcher now also persists the in-app Notification row — the
    // honest channel is fcm+in-app (the FCM push is the primary path).
    expect(result.channel).toBe('fcm+in-app');
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

  // REGRESSION (typed sweep 2026-08-16): the job used to write `type:
  // 'KYC_APPROVED'` / `body` / `channel` / `payload` — none of which exist
  // on the Notification model (type is the NotificationType enum, the body
  // column is `message`). Every such create threw at runtime and was
  // swallowed by the try/catch, so in-app notifications were silently
  // never persisted. Assert the row actually lands with a valid enum type
  // and the correct column.
  it('T-95 delegates KYC_APPROVED persistence to the service (no dispatcher-side duplicate)', async () => {
    // T-95 (PR-5, 2026-08-23): the dispatcher NO LONGER calls
    // `db.notification.create` directly for KYC_APPROVED. The
    // in-app row is created by `notificationService.notifyKycStatusChange`
    // → `createAndSend`. This unit test asserts the dispatcher
    // delegates correctly. The actual row persistence is verified
    // by the service's own unit test (and the integration test
    // that uses a real DB). The OLD test asserted the DUPLICATE
    // path (the dispatcher also created a row); that bug is
    // what T-95 fixed.
    const riderId = uuidv4();
    await testDb.rider.create({
      data: {
        id: riderId,
        riderId: uuidv4(),
        referralCode: uuidv4().slice(0, 8),
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      },
    });

    // Reset the mock so we can assert the EXACT call count.
    (notificationService.notifyKycStatusChange as ReturnType<typeof vi.fn>).mockClear();

    const result = await notificationDispatchJob.process({
      id: '7',
      payload: { type: 'KYC_APPROVED', riderId, title: 'Verified', body: 'KYC passed' },
    });

    expect(result.delivered).toBe(true);
    // T-95: the dispatcher calls the service exactly ONCE for
    // the KYC decision (was 1 service call + 1 dispatcher-side
    // db.notification.create = 2 row creates before the fix).
    expect(notificationService.notifyKycStatusChange).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyKycStatusChange).toHaveBeenCalledWith(
      riderId,
      'APPROVED'
    );
  });

  it('persists WALLET_TOPUP_APPROVED in-app row with PAYMENT enum type', async () => {
    const riderId = uuidv4();
    await testDb.rider.create({
      data: {
        id: riderId,
        riderId: uuidv4(),
        referralCode: uuidv4().slice(0, 8),
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      },
    });

    const result = await notificationDispatchJob.process({
      id: '8',
      payload: { type: 'WALLET_TOPUP_APPROVED', riderId, title: 'Top-up', body: '₹500 added' },
    });

    expect(result.delivered).toBe(true);
    const rows = await testDb.notification.findMany({ where: { riderId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('PAYMENT');
    expect(rows[0].title).toBe('Top-up');
    expect(rows[0].message).toBe('₹500 added');
  });
});
