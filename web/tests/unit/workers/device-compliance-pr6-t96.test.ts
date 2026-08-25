/**
 * T-96 (PR-6, 2026-08-23) — regression test for the
 * device-violation emit guard. The previous code:
 *
 *   1. Used a circular predicate: `rider.isLocationMandatory &&
 *      rider.deviceViolationCount > 0` (a violation exists
 *      because violations exist).
 *
 *   2. Emitted the DEVICE_VIOLATION outbox event OUTSIDE the
 *      `if (!existing)` guard, so the device-violation-emitter
 *      (which fires every minute) caused the dispatcher to
 *      receive ~1,440 DEVICE_VIOLATION events per rider per day
 *      for the same persistent violation.
 *
 *   3. No 24h alerted-marker on the violation row, so a
 *      resolved-then-re-violated permission would re-alert
 *      immediately.
 *
 * The fix moves the emit INSIDE the guard, drops the circular
 * predicate clause, and stamps `lastAlertedAt` on creation.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.5.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const findManyRiderMock = vi.fn();
const findFirstViolationMock = vi.fn();
const createViolationMock = vi.fn();
const updateManyViolationMock = vi.fn();
const emitOutboxMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findMany: (...args: unknown[]) => findManyRiderMock(...args) },
    deviceViolation: {
      findFirst: (...args: unknown[]) => findFirstViolationMock(...args),
      create: (...args: unknown[]) => createViolationMock(...args),
      updateMany: (...args: unknown[]) => updateManyViolationMock(...args),
    },
  },
}));

vi.mock('@/server/workers/outbox', () => ({
  OutboxService: {
    emit: (...args: unknown[]) => emitOutboxMock(...args),
  },
  OutboxEventTypes: { DEVICE_VIOLATION: 'DEVICE_VIOLATION' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { deviceComplianceJob } from '@/server/workers/jobs/device-compliance.job';

describe('T-96 device-violation emit guard', () => {
  beforeEach(() => {
    findManyRiderMock.mockReset();
    findFirstViolationMock.mockReset();
    createViolationMock.mockReset();
    updateManyViolationMock.mockReset();
    emitOutboxMock.mockReset();
    updateManyViolationMock.mockResolvedValue({ count: 0 });
    emitOutboxMock.mockResolvedValue('event-id');
  });
  afterEach(() => vi.useRealTimers());

  it('emits ONLY when a fresh violation is created (not for already-active ones)', async () => {
    findManyRiderMock.mockResolvedValue([
      {
        id: 'rider-1',
        isLocationMandatory: true,
        // T-96: the old circular predicate was
        // `deviceViolationCount > 0`. The new code doesn't
        // check that — every location-mandatory rider gets the
        // check, but the emit is gated on `!existing`.
        deviceViolationCount: 5,
        isAppsControlRestricted: false,
        isUninstallBlocked: false,
      },
    ]);
    // T-96: a violation already exists for the location permission
    // (the persistent-violation case the audit identified as
    // the source of the 1,440/day spam).
    findFirstViolationMock.mockResolvedValue({
      id: 'existing-violation-1',
      riderId: 'rider-1',
      permissionId: 'location',
      status: 'ACTIVE',
    });
    createViolationMock.mockResolvedValue({ id: 'new-violation-1' });

    const result = await deviceComplianceJob.process({
      id: 'job-1',
    } as unknown as Parameters<typeof deviceComplianceJob.process>[0]);

    // T-96: NO new violation was created, NO emit was fired.
    expect(createViolationMock).not.toHaveBeenCalled();
    expect(emitOutboxMock).not.toHaveBeenCalled();
    expect(result.violationsFound).toBe(0);
  });

  it('emits exactly once when a fresh violation is created', async () => {
    findManyRiderMock.mockResolvedValue([
      {
        id: 'rider-1',
        isLocationMandatory: true,
        deviceViolationCount: 0, // T-96: doesn't matter now
        isAppsControlRestricted: false,
        isUninstallBlocked: false,
      },
    ]);
    findFirstViolationMock.mockResolvedValue(null); // no existing
    createViolationMock.mockResolvedValue({ id: 'new-violation-1' });

    const result = await deviceComplianceJob.process({
      id: 'job-2',
    } as unknown as Parameters<typeof deviceComplianceJob.process>[0]);

    // T-96: a fresh violation is created AND the emit fires.
    expect(createViolationMock).toHaveBeenCalledTimes(1);
    expect(createViolationMock.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        riderId: 'rider-1',
        permissionId: 'location',
        status: 'ACTIVE',
        // T-96: the 24h alerted-marker is stamped on creation.
        lastAlertedAt: expect.any(Date),
      })
    );
    expect(emitOutboxMock).toHaveBeenCalledTimes(1);
    expect(result.violationsFound).toBe(1);
  });

  it('does not use the circular `deviceViolationCount > 0` predicate', async () => {
    // T-96: a rider who has NEVER had a violation (count=0) but
    // has revoked a mandatory permission still gets the
    // violation check. The previous code's `&& count > 0`
    // meant these riders were silently skipped.
    findManyRiderMock.mockResolvedValue([
      {
        id: 'rider-2',
        isLocationMandatory: true,
        deviceViolationCount: 0,
        isAppsControlRestricted: false,
        isUninstallBlocked: false,
      },
    ]);
    findFirstViolationMock.mockResolvedValue(null);
    createViolationMock.mockResolvedValue({ id: 'v-1' });

    await deviceComplianceJob.process({
      id: 'job-3',
    } as unknown as Parameters<typeof deviceComplianceJob.process>[0]);
    expect(createViolationMock).toHaveBeenCalledTimes(1);
  });
});
