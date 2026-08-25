/**
 * T-94 (PR-4, 2026-08-23) — regression test for the GDPR purge
 * field/file scope completion. The previous purge missed:
 *   - `Rider.dob`, `lockPasswordHash`, `deletionRequestReason`,
 *     `lastKnownLat`, `lastKnownLng`
 *   - the relational `RiderPickupPhoto` rows
 *   - the on-disk photo files
 *   - the older AuditLog rows that referenced the rider's entityId
 *
 * The test asserts the new field set, the `RiderPickupPhoto`
 * row wipe, and the AuditLog row scrub.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.3.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const findManyMock = vi.fn();
const updateMock = vi.fn();
const updateManyMock = vi.fn();
const deleteManyRiderPickupMock = vi.fn();
const deleteManyAuditLogMock = vi.fn();
const createAuditLogMock = vi.fn();

const inTransactionCallbacks: Array<(tx: unknown) => unknown> = [];

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findMany: (...args: unknown[]) => findManyMock(...args) },
    $transaction: (fn: (tx: unknown) => unknown) => {
      inTransactionCallbacks.push(fn);
      const tx = {
        rider: {
          update: (...args: unknown[]) => updateMock(...args),
        },
        kycProfile: {
          updateMany: (...args: unknown[]) => updateManyMock('kyc', ...args),
        },
        guarantor: {
          updateMany: (...args: unknown[]) => updateManyMock('guarantor', ...args),
        },
        riderPickupPhoto: {
          deleteMany: (...args: unknown[]) => deleteManyRiderPickupMock(...args),
        },
        auditLog: {
          deleteMany: (...args: unknown[]) => deleteManyAuditLogMock(...args),
          create: (...args: unknown[]) => createAuditLogMock(...args),
        },
      };
      return fn(tx);
    },
  },
}));

vi.mock('@/lib/idempotency', () => ({
  checkOrClaimIdempotency: vi.fn().mockResolvedValue({ status: 'not_found' }),
  completeIdempotency: vi.fn().mockResolvedValue(undefined),
  failIdempotency: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dataDeletionPurgeJob } from '@/server/workers/jobs/data-deletion-purge.job';

describe('T-94 GDPR purge field/file scope', () => {
  beforeEach(() => {
    inTransactionCallbacks.length = 0;
    findManyMock.mockReset();
    updateMock.mockReset();
    updateManyMock.mockReset();
    deleteManyRiderPickupMock.mockReset();
    deleteManyAuditLogMock.mockReset();
    createAuditLogMock.mockReset();
    findManyMock.mockResolvedValue([
      {
        id: 'rider-1',
        deletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      },
    ]);
    updateMock.mockResolvedValue({});
    updateManyMock.mockResolvedValue({ count: 1 });
    deleteManyRiderPickupMock.mockResolvedValue({ count: 1 });
    deleteManyAuditLogMock.mockResolvedValue({ count: 3 });
    createAuditLogMock.mockResolvedValue({ id: 'audit-1' });
  });
  afterEach(() => vi.useRealTimers());

  it('NULLs the T-94-added PII fields (dob, lockPasswordHash, deletionRequestReason, lastKnownLat, lastKnownLng)', async () => {
    const result = await dataDeletionPurgeJob.process({
      id: 'job-1',
    } as unknown as Parameters<typeof dataDeletionPurgeJob.process>[0]);
    expect(result.purged).toBe(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const data = updateMock.mock.calls[0][0].data;
    // T-94: previously-missing fields now explicitly NULLed.
    expect(data.dob).toBeNull();
    expect(data.lockPasswordHash).toBeNull();
    expect(data.deletionRequestReason).toBeNull();
    expect(data.lastKnownLat).toBeNull();
    expect(data.lastKnownLng).toBeNull();
    expect(data.lastLocationAt).toBeNull();
    expect(data.planRejectionReason).toBeNull();
    // The original fields still present.
    expect(data.email).toBeNull();
    expect(data.fatherName).toBeNull();
    expect(data.motherName).toBeNull();
  });

  it('deletes the RiderPickupPhoto rows', async () => {
    await dataDeletionPurgeJob.process({
      id: 'job-2',
    } as unknown as Parameters<typeof dataDeletionPurgeJob.process>[0]);
    expect(deleteManyRiderPickupMock).toHaveBeenCalledTimes(1);
    expect(deleteManyRiderPickupMock).toHaveBeenCalledWith({
      where: { riderId: 'rider-1' },
    });
  });

  it('scrubs older AuditLog rows referencing the rider', async () => {
    // T-94: the previous purge left old audit-log rows in place
    // (the RIDER_DATA_DELETION_PURGED row was the only new one).
    // The `details` JSON on those older rows could contain PII
    // (free-text review notes, etc.). We delete them, except the
    // new RIDER_DATA_DELETION_PURGED row we just wrote.
    await dataDeletionPurgeJob.process({
      id: 'job-3',
    } as unknown as Parameters<typeof dataDeletionPurgeJob.process>[0]);
    expect(deleteManyAuditLogMock).toHaveBeenCalledTimes(1);
    expect(deleteManyAuditLogMock).toHaveBeenCalledWith({
      where: {
        entityId: 'rider-1',
        action: { not: 'RIDER_DATA_DELETION_PURGED' },
      },
    });
  });

  it('writes the RIDER_DATA_DELETION_PURGED audit row with the field list', async () => {
    await dataDeletionPurgeJob.process({
      id: 'job-4',
    } as unknown as Parameters<typeof dataDeletionPurgeJob.process>[0]);
    expect(createAuditLogMock).toHaveBeenCalledTimes(1);
    const details = JSON.parse(createAuditLogMock.mock.calls[0][0].data.details);
    expect(details.fields).toContain('dob');
    expect(details.fields).toContain('lockPasswordHash');
    expect(details.fields).toContain('deletionRequestReason');
    expect(details.fields).toContain('lastKnownLat');
    expect(details.fields).toContain('lastKnownLng');
    expect(details.fields).toContain('RiderPickupPhoto rows');
    expect(details.fields).toContain('AuditLog rows referencing this rider (pre-purge)');
  });

  it('short-circuits when no expired soft-deletions exist (no in-tx work)', async () => {
    findManyMock.mockResolvedValue([]);
    const result = await dataDeletionPurgeJob.process({
      id: 'job-5',
    } as Parameters<typeof dataDeletionPurgeJob.process>[0]);
    expect(result.purged).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
    expect(deleteManyRiderPickupMock).not.toHaveBeenCalled();
    expect(deleteManyAuditLogMock).not.toHaveBeenCalled();
  });
});
