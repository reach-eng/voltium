/**
 * T-91 (PR-1, 2026-08-23) — regression test for the KYC
 * INFO_REQUESTED dispatch. The previous audit identified that
 * the producer emitted `KYC_INFO_REQUESTED` and the consumer
 * (notification-dispatch.job.ts) only handled `KYC_INFO_REQUIRED`,
 * causing the entire event class to fall into the default-ack
 * branch and be silently lost. This test asserts:
 *
 *   1. The dispatcher's switch handles `KYC_INFO_REQUESTED` and
 *      calls `notificationService.notifyKycStatusChange`.
 *   2. The dispatcher's switch handles `KYC_INFO_REQUIRED`
 *      (the existing spelling, kept for back-compat).
 *   3. Both spellings reach the same FCM + in-app path.
 *   4. Unknown payload types fire the alert-once-per-hour hook.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §1.2.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mocks BEFORE the import.
const notifyKycStatusChangeMock = vi.fn();
const notificationCreateMock = vi.fn();
const alerterSendMock = vi.fn();
const fcmSendOverlayMock = vi.fn();

vi.mock('@/lib/notification-service', () => ({
  notificationService: {
    notifyKycStatusChange: (...args: unknown[]) =>
      notifyKycStatusChangeMock(...args),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    notification: { create: (...args: unknown[]) => notificationCreateMock(...args) },
    rider: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/fcm', () => ({
  fcmService: {
    sendPushNotification: vi.fn(),
    sendOverlayTrigger: (...args: unknown[]) => fcmSendOverlayMock(...args),
  },
}));

vi.mock('@/lib/alerter', () => ({
  alerter: { send: (...args: unknown[]) => alerterSendMock(...args) },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { notificationDispatchJob } from '@/server/workers/jobs/notification-dispatch.job';

describe('T-91 notification-dispatch handles KYC_INFO_REQUESTED', () => {
  beforeEach(() => {
    notifyKycStatusChangeMock.mockReset();
    notificationCreateMock.mockReset();
    alerterSendMock.mockReset();
    notificationCreateMock.mockResolvedValue({ id: 'notif-1' });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatches KYC_INFO_REQUESTED to FCM + in-app', async () => {
    const result = await notificationDispatchJob.process({
      id: 'job-1',
      payload: {
        type: 'KYC_INFO_REQUESTED',
        riderId: 'rider-kyc',
        infoRequest: 'Please re-upload your Aadhaar front',
      },
    });
    // The fix: the dispatcher MUST call notifyKycStatusChange
    // (the previous default-ack branch returned `delivered:false`).
    expect(notifyKycStatusChangeMock).toHaveBeenCalledTimes(1);
    expect(notifyKycStatusChangeMock).toHaveBeenCalledWith(
      'rider-kyc',
      'INFO_REQUIRED',
      'Please re-upload your Aadhaar front'
    );
    // T-95: the in-app persistence is now done INSIDE
    // `createAndSend` (single source of truth). The dispatcher
    // does NOT call `db.notification.create` separately — that
    // was the double-persistence bug. We assert NO direct
    // notification create happens here.
    expect(notificationCreateMock).not.toHaveBeenCalled();
    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('fcm+in-app');
  });

  it('still handles the legacy KYC_INFO_REQUIRED spelling', async () => {
    await notificationDispatchJob.process({
      id: 'job-2',
      payload: {
        type: 'KYC_INFO_REQUIRED',
        riderId: 'rider-kyc',
        reason: 'PAN card image is blurry',
      },
    });
    expect(notifyKycStatusChangeMock).toHaveBeenCalledTimes(1);
    expect(notifyKycStatusChangeMock).toHaveBeenCalledWith(
      'rider-kyc',
      'INFO_REQUIRED',
      'PAN card image is blurry'
    );
  });

  it('rejects malformed payload (missing riderId)', async () => {
    const result = await notificationDispatchJob.process({
      id: 'job-3',
      payload: { type: 'KYC_APPROVED' }, // no riderId
    });
    expect(result.delivered).toBe(false);
    expect(result.warning).toBe('malformed payload');
    expect(notifyKycStatusChangeMock).not.toHaveBeenCalled();
  });

  it('alerts + acks unknown payload types (does not silently drop)', async () => {
    // T-91: unknown types are NO LONGER silently acked. The
    // alerter fires once per type per hour.
    const result = await notificationDispatchJob.process({
      id: 'job-4',
      payload: {
        type: 'TYPOED_SPELLING_KYC' as unknown as 'KYC_APPROVED',
        riderId: 'rider-x',
      },
    });
    expect(result.delivered).toBe(false);
    // T-91: warning kept as `unknown type` to match the
    // existing public contract; the alert is the new behavior.
    expect(result.warning).toBe('unknown type');
    // The alerter was invoked so the team is paged within 1h.
    expect(alerterSendMock).toHaveBeenCalledTimes(1);
    expect(alerterSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Unknown NOTIFICATION_SEND payload type',
        details: { type: 'TYPOED_SPELLING_KYC' },
      })
    );
  });
});
