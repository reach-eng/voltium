import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import {
  checkOrClaimIdempotency,
  completeIdempotency,
  failIdempotency,
} from '@/lib/idempotency';
import { dataDeletionPurgeJob } from '@/server/workers/jobs/data-deletion-purge.job';

// PR-7 (2026-08-06 fix-plan; 1st audit P0-1): the admin DELETE endpoint only
// soft-deletes. GDPR/DPDP §6 requires PII destruction once the 7-day appeal
// window passes — this is the scheduled hard-anonymize step.
vi.mock('@/lib/db', () => ({
  db: {
    rider: { findMany: vi.fn(), update: vi.fn() },
    kycProfile: { updateMany: vi.fn() },
    guarantor: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<number>) => cb({})),
  },
}));

vi.mock('@/lib/idempotency', () => ({
  checkOrClaimIdempotency: vi.fn(),
  completeIdempotency: vi.fn().mockResolvedValue(undefined),
  failIdempotency: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('dataDeletionPurgeJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkOrClaimIdempotency).mockResolvedValue({
      status: 'not_found',
    } as any);
  });

  it('skips when already processed today (idempotency claimed)', async () => {
    vi.mocked(checkOrClaimIdempotency).mockResolvedValue({
      status: 'found',
      record: { id: 'x' },
    } as any);

    const result = await dataDeletionPurgeJob.process({ id: 'job-1' } as any);

    expect(result).toEqual({ purged: 0 });
    expect(db.rider.findMany).not.toHaveBeenCalled();
  });

  it('targets only soft-deleted riders past the 7-day cutoff', async () => {
    vi.mocked(db.rider.findMany).mockResolvedValue([
      { id: 'rider-1', deletedAt: new Date('2026-08-01T00:00:00Z') },
    ] as any);
    const tx = {
      rider: { update: vi.fn() },
      kycProfile: { updateMany: vi.fn() },
      guarantor: { updateMany: vi.fn() },
      // T-94 (PR-4, 2026-08-23): the purge now also wipes
      // RiderPickupPhoto rows + scrubs older AuditLog rows.
      riderPickupPhoto: { deleteMany: vi.fn() },
      auditLog: { create: vi.fn(), deleteMany: vi.fn() },
    };
    vi.mocked(db.$transaction).mockImplementation(
      async (cb: (t: any) => Promise<number>) => cb(tx)
    );

    const result = await dataDeletionPurgeJob.process({ id: 'job-1' } as any);

    expect(result).toEqual({ purged: 1 });
    // Explicit `deletedAt: { not: null }` overrides the soft-delete
    // middleware default so purged-but-still-deleted rows are visible.
    const where = vi.mocked(db.rider.findMany).mock.calls[0][0].where;
    expect(where.lifecycleStatus).toBe('CLOSED');
    // `deletedAt: { not: null, ... }` is set EXPLICITLY — this is what
    // overrides the soft-delete middleware default (`deletedAt: null`),
    // otherwise purged-but-still-deleted rows would be invisible.
    expect(where.deletedAt).toBeDefined();
    // T-94: the new tx-side wipe + scrub were called.
    expect(tx.riderPickupPhoto.deleteMany).toHaveBeenCalled();
    expect(tx.auditLog.deleteMany).toHaveBeenCalled();
    expect(where.deletedAt.not).toBeNull(); // `{ not: null }` = include deleted
    expect(where.deletedAt.lt).toBeInstanceOf(Date);
    // PR-2026-08-16: already-purged riders are excluded so re-runs don't
    // re-anonymize PII or duplicate the audit row.
    expect(where.purgedAt).toBeNull();

    // PII nulled on Rider, KYC profile and guarantor rows. `phone` and
    // `referralCode` are non-nullable @unique columns → deterministic
    // sentinel, not NULL.
    const updateCall = tx.rider.update.mock.calls[0][0];
    expect(updateCall).toEqual(
      expect.objectContaining({
        where: { id: 'rider-1' },
        data: expect.objectContaining({
          email: null,
          fullName: '[PURGED]',
          // PR-2026-08-16: purgedAt marker so the admin queue can
          // distinguish "purged" from "pending 7-day window".
          purgedAt: expect.any(Date),
        }),
      })
    );
    expect(updateCall.data.phone).toMatch(/^PURGED-/);
    expect(updateCall.data.referralCode).toMatch(/^PURGED-/);
    expect(updateCall.data.phone).toBe(updateCall.data.referralCode);
    expect(tx.kycProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riderId: 'rider-1' },
        data: expect.objectContaining({
          aadhaarNumber: null,
          panNumber: null,
          accountNumber: null,
        }),
      })
    );
    expect(tx.guarantor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riderId: 'rider-1' },
        data: expect.objectContaining({ name: null, phone: null }),
      })
    );

    // GDPR Art. 30 processing record.
    expect(JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details).fields).toContain('phone');
    expect(JSON.parse(tx.auditLog.create.mock.calls[0][0].data.details).fields).toContain('aadhaarNumber');
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'RIDER_DATA_DELETION_PURGED',
          entityId: 'rider-1',
        }),
      })
    );
    expect(completeIdempotency).toHaveBeenCalledWith(
      `data-deletion-purge:daily:${istDateKey(clock.now())}`,
      { purged: 1 }
    );
  });

  it('records the purged run even when nothing crosses the cutoff', async () => {
    vi.mocked(db.rider.findMany).mockResolvedValue([]);

    const result = await dataDeletionPurgeJob.process({ id: 'job-1' } as any);

    expect(result).toEqual({ purged: 0 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(completeIdempotency).toHaveBeenCalled();
  });

  it('releases the idempotency claim on failure', async () => {
    vi.mocked(db.rider.findMany).mockRejectedValue(new Error('db down'));

    await expect(
      dataDeletionPurgeJob.process({ id: 'job-1' } as any)
    ).rejects.toThrow('db down');
    expect(failIdempotency).toHaveBeenCalled();
  });
});
