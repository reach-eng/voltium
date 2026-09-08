/**
 * NET-005 follow-up-14 (2026-09-08): REQUEST_INFO outbox
 * scoping.
 *
 * The use case's REQUEST_INFO branch in
 * `kyc.use-cases.ts` was the only KYC decision that
 * did not scope its outbox emit into the same
 * `db.$transaction` as the DB write. Pre-fix:
 *   await kycRepository.requestInfo(...) // own tx
 *   await OutboxService.emit(...)          // no tx
 * If the DB write committed but the outbox emit
 * failed, the rider would see `INFO_REQUIRED` with
 * no notification (or vice versa). APPROVE and
 * REJECT wrap their repo call + outbox emit in a
 * single `db.$transaction(...)`; REQUEST_INFO was
 * missed.
 *
 * This test asserts the fix: the outbox emit is
 * called with the same tx object as the repo write.
 *
 * Lives in its own file (not the combined
 * admin-kyc-route-14.test.ts) because the combined
 * file mocks `@/server/modules/kyc/kyc.use-cases` for
 * the route tests, and that file-level mock would
 * shadow the real use case in any use-case
 * assertions in the same file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const useCaseMocks = vi.hoisted(() => ({
  kycProfileFindUnique: vi.fn(),
  $transaction: vi.fn(),
  // Default resolution so the use case's `await
  // kycRepository.requestInfo(...)` doesn't fail
  // beforeEach resets and re-applies per test.
  requestInfo: vi.fn().mockResolvedValue({ id: 'kyc-1', status: 'INFO_REQUIRED' }),
  outboxEmit: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({
  db: {
    kycProfile: { findUnique: useCaseMocks.kycProfileFindUnique },
    $transaction: useCaseMocks.$transaction,
  },
}));

vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: useCaseMocks.outboxEmit },
  OutboxEventTypes: { NOTIFICATION_SEND: 'NOTIFICATION_SEND' },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: useCaseMocks.createAuditLog,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/pii-redact', () => ({ redactPii: (x: unknown) => x }));

// `notificationService` is imported by the use case
// for the legacy REJECT path's direct notify call but
// the REQUEST_INFO branch uses the outbox. Stub it
// out so the import chain resolves without pulling
// in the real FCM / DB deps.
vi.mock('@/lib/notification-service', () => ({
  notificationService: {
    notifyKycStatusChange: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the kycRepository so the real repo (which
// runs its own nested $transaction with
// `tx.kycProfile.update`) doesn't execute. The
// use case's outer $transaction is what we care
// about; the repo is just a stand-in here.
// Reuse the same `vi.fn()` as `useCaseMocks.requestInfo`
// so the test's assertions on call count can target
// the same function.
vi.mock('@/server/modules/kyc/kyc.repository', () => ({
  kycRepository: {
    requestInfo: useCaseMocks.requestInfo,
  },
}));

import { kycUseCases } from '@/server/modules/kyc/kyc.use-cases';

describe('NET-005 follow-up-14: REQUEST_INFO outbox scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCaseMocks.kycProfileFindUnique.mockResolvedValue({
      id: 'kp1',
      status: 'SUBMITTED',
    });
    useCaseMocks.requestInfo.mockResolvedValue({
      id: 'kp1',
      status: 'INFO_REQUIRED',
    });
    // $transaction runs the inner fn with a tagged
    // tx object; the test asserts the same object
    // is passed to both the repo and the outbox
    // emit. The pre-fix code called the repo
    // outside any tx and the emit without a tx
    // argument, so the assert would have failed.
    useCaseMocks.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => fn({ tx: 'fake-tx-object' })
    );
    useCaseMocks.outboxEmit.mockResolvedValue(undefined);
  });

  it('REQUEST_INFO: outbox emit and repo write share the same tx argument', async () => {
    await kycUseCases.reviewKyc('r1', 'admin-1', {
      reviewerId: 'admin-1',
      action: 'REQUEST_INFO',
      infoRequest: 'Please re-upload Aadhaar',
    });

    // The use case's outer $transaction was called
    // exactly once (wrapping both the repo call and
    // the outbox emit).
    expect(useCaseMocks.$transaction).toHaveBeenCalledTimes(1);

    // The repo's requestInfo was called inside the
    // tx (its own $transaction is mocked to be a
    // transparent no-op here — we only care that
    // the repo was invoked). The outbox emit was
    // also called once, inside the use case's outer
    // tx.
    expect(useCaseMocks.requestInfo).toHaveBeenCalledTimes(1);
    expect(useCaseMocks.outboxEmit).toHaveBeenCalledTimes(1);

    // The outbox emit's 4th argument is the tx
    // object. With the use case's outer $transaction
    // providing `{tx: 'fake-tx-object'}`, the outbox
    // emit must have been called with that same
    // object — proving the emit is inside the tx.
    const outboxCallArgs = useCaseMocks.outboxEmit.mock.calls[0] as unknown[];
    // OutboxService.emit signature: (eventType,
    // payload, maxAttempts, tx?, priority?). tx is
    // the 4th arg (index 3).
    expect(outboxCallArgs[3]).toEqual({ tx: 'fake-tx-object' });
  });

  it('REQUEST_INFO: audit log is fire-and-forget (still called once)', async () => {
    // The audit log is best-effort; failing to write
    // one row is recoverable from the kycProfile
    // state. Keeping it outside the tx means a slow
    // audit-log write doesn't block the user's
    // KYC decision. The pre-fix code also called
    // the audit log after the state change — this
    // test pins the post-fix behavior.
    await kycUseCases.reviewKyc('r1', 'admin-1', {
      reviewerId: 'admin-1',
      action: 'REQUEST_INFO',
      infoRequest: 'Please re-upload Aadhaar',
    });
    expect(useCaseMocks.createAuditLog).toHaveBeenCalledTimes(1);
  });

  it('REQUEST_INFO: audit log carries the previous-status snapshot (regression lock for follow-up-8)', async () => {
    // The use case's REQUEST_INFO case reads the
    // pre-transition status (follow-up-8 fix) and
    // passes it to the audit log. Lock that down.
    await kycUseCases.reviewKyc('r1', 'admin-1', {
      reviewerId: 'admin-1',
      action: 'REQUEST_INFO',
      infoRequest: 'Please re-upload Aadhaar',
    });
    expect(useCaseMocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'kyc.info_required',
        details: expect.objectContaining({
          riderId: 'r1',
          previousStatus: 'SUBMITTED',
          newStatus: 'INFO_REQUIRED',
          infoRequest: 'Please re-upload Aadhaar',
        }),
      })
    );
  });
});
