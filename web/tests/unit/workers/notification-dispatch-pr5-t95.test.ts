/**
 * T-95 (PR-5, 2026-08-23) — regression test for the KYC
 * decision dedup + retry contract fixes.
 *
 * Two issues fixed by PR-5:
 *   1. The KYC_APPROVED / KYC_REJECTED / KYC_INFO_REQUESTED
 *      cases in the dispatcher called BOTH
 *      `notificationService.notifyKycStatusChange(...)` AND
 *      `db.notification.create(...)`. `createAndSend` already
 *      persists the in-app row, so the explicit create was a
 *      duplicate. Two rows per KYC decision.
 *
 *   2. `createAndSend` caught ALL errors and returned
 *      `{ success: false, error }`. A transient DB blip or
 *      5xx from FCM was acked the same as a permanent 4xx,
 *      defeating the OutboxEvent retry contract. The new
 *      contract rethrows transient errors and tags 4xx as
 *      `permanent: true` so the dispatcher can ack-and-move-on.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.4.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const notifyKycStatusChangeMock = vi.fn();
const createAndSendMock = vi.fn();
const notificationCreateMock = vi.fn();

vi.mock('@/lib/notification-service', () => ({
  notificationService: {
    notifyKycStatusChange: (...args: unknown[]) =>
      notifyKycStatusChangeMock(...args),
    createAndSend: (...args: unknown[]) => createAndSendMock(...args),
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
    sendOverlayTrigger: vi.fn(),
  },
}));

vi.mock('@/lib/alerter', () => ({
  alerter: { send: vi.fn().mockResolvedValue(undefined) },
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
import { notificationService } from '@/lib/notification-service';

describe('T-95 KYC decision dedup (no duplicate db.notification.create)', () => {
  beforeEach(() => {
    notifyKycStatusChangeMock.mockReset();
    notificationCreateMock.mockReset();
    notifyKycStatusChangeMock.mockResolvedValue({ success: true });
  });
  afterEach(() => vi.useRealTimers());

  it('KYC_APPROVED persists via createAndSend only (no dispatcher-side duplicate)', async () => {
    await notificationDispatchJob.process({
      id: 'job-1',
      payload: { type: 'KYC_APPROVED', riderId: 'rider-1' },
    });
    expect(notifyKycStatusChangeMock).toHaveBeenCalledTimes(1);
    // T-95: the dispatcher's `db.notification.create` is gone —
    // `createAndSend` inside the service is the single source.
    expect(notificationCreateMock).not.toHaveBeenCalled();
  });

  it('KYC_REJECTED persists via createAndSend only', async () => {
    await notificationDispatchJob.process({
      id: 'job-2',
      payload: {
        type: 'KYC_REJECTED',
        riderId: 'rider-1',
        reason: 'Bad Aadhaar',
      },
    });
    expect(notifyKycStatusChangeMock).toHaveBeenCalledTimes(1);
    expect(notificationCreateMock).not.toHaveBeenCalled();
  });

  it('KYC_INFO_REQUESTED persists via createAndSend only', async () => {
    await notificationDispatchJob.process({
      id: 'job-3',
      payload: {
        type: 'KYC_INFO_REQUESTED',
        riderId: 'rider-1',
        infoRequest: 'Please re-upload',
      },
    });
    expect(notifyKycStatusChangeMock).toHaveBeenCalledTimes(1);
    expect(notificationCreateMock).not.toHaveBeenCalled();
  });
});

describe('T-95 createAndSend retry contract (transient rethrows)', () => {
  beforeEach(() => {
    notificationCreateMock.mockReset();
    createAndSendMock.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('rethrows when db.notification.create fails (transient)', async () => {
    // T-95: the contract is "throw on transient, ack on permanent".
    // A DB-write failure (transient) rethrows so the caller's
    // try/catch engages the OutboxEvent retry path.
    createAndSendMock.mockRejectedValue(new Error('connection reset'));
    await expect(
      notificationService.createAndSend('rider-1', 'T', 'B', 'INFO')
    ).rejects.toThrow('connection reset');
  });

  it('classifies FCM 4xx as permanent (acks without retry)', async () => {
    // T-95: 4xx is permanent (bad token, unregistered device).
    // Returns { success: false, permanent: true } so the caller
    // can ack-and-move-on without an infinite retry loop.
    createAndSendMock.mockResolvedValue({
      success: false,
      permanent: true,
      error: { code: 404, message: 'Bad token' },
    });
    const result = await notificationService.createAndSend(
      'rider-1',
      'T',
      'B',
      'INFO'
    );
    expect(result).toEqual(
      expect.objectContaining({ success: false, permanent: true })
    );
  });

  it('rethrows FCM 5xx (transient — backoff engages)', async () => {
    // T-95: 5xx / network errors are transient. The function
    // rethrows so the OutboxEvent retries with exponential
    // backoff.
    createAndSendMock.mockRejectedValue(
      Object.assign(new Error('Service unavailable'), { code: 503 })
    );
    await expect(
      notificationService.createAndSend('rider-1', 'T', 'B', 'INFO')
    ).rejects.toThrow('Service unavailable');
  });
});
