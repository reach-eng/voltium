/**
 * submitGuarantor + approveGuarantor repository unit tests
 * (PR-ONBOARDING-FLOW-2026-08-13).
 *
 * Verifies the parallel KYC + guarantor flow:
 *   - submitGuarantor at rank 2 (PROFILE_SUBMITTED) bumps to GUARANTOR_SUBMITTED
 *   - submitGuarantor at rank 3 (KYC_SUBMITTED) bumps to GUARANTOR_SUBMITTED
 *   - submitGuarantor at rank 4 (KYC_APPROVED) bumps to GUARANTOR_SUBMITTED
 *   - submitGuarantor at rank 5+ leaves the lifecycle alone
 *   - approveGuarantor at rank 5 (GUARANTOR_SUBMITTED) bumps to GUARANTOR_APPROVED
 *   - approveGuarantor at rank 4 (KYC_APPROVED, race) bumps to GUARANTOR_APPROVED
 *
 * The active path runs KYC + guarantor in parallel, so the rider can
 * submit the guarantor form while still in PROFILE_SUBMITTED,
 * KYC_SUBMITTED, or KYC_APPROVED. The previous guard
 * `lifecycleStatus: { in: ['PROFILE_SUBMITTED'] }` only handled
 * rank 2, leaving rank 3-4 riders stuck on the guarantor form
 * forever (the lifecycle gate re-routes them back since their rank
 * never advances).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockRiderUpdateMany = vi.fn();
const mockInvalidateCache = vi.fn();

const mockTx = {
  guarantor: {
    upsert: mockUpsert,
    update: mockUpdate,
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUniqueOrThrow: mockUpdate,
  },
  rider: {
    updateMany: mockRiderUpdateMany,
  },
};

const mockDb = {
  guarantor: {
    findUnique: mockFindUnique,
  },
  rider: {
    updateMany: mockRiderUpdateMany,
  },
  $transaction: vi.fn((fn) => fn(mockTx)),
};

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/server-cache', () => ({ invalidateRiderCache: mockInvalidateCache }));
vi.mock('@/lib/pii-crypto', () => ({
  encryptPii: (s: string) => `enc(${s})`,
  decryptPii: (s: string) => s.replace(/^enc\((.*)\)$/, '$1'),
}));

const { guarantorRepository } = await import('@/server/modules/guarantors/guarantor.repository');

const RIDER_ID = 'rider-1';

describe('submitGuarantor — parallel KYC+guarantor lifecycle bump (PR-ONBOARDING-FLOW-2026-08-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation((fn) => fn(mockTx));
    mockFindUnique.mockResolvedValue({ status: 'DRAFT' });
    mockUpsert.mockResolvedValue({ id: 'g-1', riderId: RIDER_ID, status: 'SUBMITTED' });
  });

  it('bumps PROFILE_SUBMITTED (rank 2) to GUARANTOR_SUBMITTED', async () => {
    await guarantorRepository.submitGuarantor(RIDER_ID, { fullName: 'John' });

    expect(mockRiderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: RIDER_ID,
        lifecycleStatus: {
          in: ['PROFILE_SUBMITTED', 'KYC_SUBMITTED', 'KYC_APPROVED'],
        },
      },
      data: { lifecycleStatus: 'GUARANTOR_SUBMITTED' },
    });
  });

  it('includes KYC_SUBMITTED (rank 3) in the allowlist — the parallel-KYC fix', async () => {
    await guarantorRepository.submitGuarantor(RIDER_ID, { fullName: 'John' });

    const whereArg = mockRiderUpdateMany.mock.calls[0][0].where;
    expect(whereArg.lifecycleStatus.in).toContain('KYC_SUBMITTED');
  });

  it('includes KYC_APPROVED (rank 4) in the allowlist — the parallel-KYC fix', async () => {
    await guarantorRepository.submitGuarantor(RIDER_ID, { fullName: 'John' });

    const whereArg = mockRiderUpdateMany.mock.calls[0][0].where;
    expect(whereArg.lifecycleStatus.in).toContain('KYC_APPROVED');
  });

  it('does NOT include higher ranks (5+) — the bump should be a no-op for already-past riders', async () => {
    await guarantorRepository.submitGuarantor(RIDER_ID, { fullName: 'John' });

    const whereArg = mockRiderUpdateMany.mock.calls[0][0].where;
    // The previous bug was the opposite — the guard only included
    // rank 2, so rank 3-4 riders were skipped. Now we verify the
    // guard is the right SIZE (covers 2-4) and does not over-fire.
    expect(whereArg.lifecycleStatus.in).not.toContain('GUARANTOR_APPROVED');
    expect(whereArg.lifecycleStatus.in).not.toContain('PLAN_SELECTED');
    expect(whereArg.lifecycleStatus.in).not.toContain('PICKUP_SCHEDULED');
    expect(whereArg.lifecycleStatus.in).not.toContain('ACTIVE');
  });

  it('encrypts the pan field before write (PII guard)', async () => {
    await guarantorRepository.submitGuarantor(RIDER_ID, { fullName: 'John', pan: 'ABCDE1234F' });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ pan: 'enc(ABCDE1234F)' }),
        update: expect.objectContaining({ pan: 'enc(ABCDE1234F)' }),
      })
    );
  });
});

describe('approveGuarantor — accept KYC_APPROVED race condition (PR-ONBOARDING-FLOW-2026-08-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation((fn) => fn(mockTx));
    mockFindUnique.mockResolvedValue({ status: 'SUBMITTED' });
    mockUpdate.mockResolvedValue({ id: 'g-1', riderId: RIDER_ID, status: 'APPROVED' });
  });

  it('bumps GUARANTOR_SUBMITTED (rank 5) to GUARANTOR_APPROVED', async () => {
    await guarantorRepository.approveGuarantor(RIDER_ID, 'admin-1');

    expect(mockRiderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: RIDER_ID,
        lifecycleStatus: {
          in: ['GUARANTOR_SUBMITTED', 'KYC_APPROVED'],
        },
      },
      data: { lifecycleStatus: 'GUARANTOR_APPROVED' },
    });
  });

  it('includes KYC_APPROVED in the allowlist — the race-with-KYC fix', async () => {
    await guarantorRepository.approveGuarantor(RIDER_ID, 'admin-1');

    const whereArg = mockRiderUpdateMany.mock.calls[0][0].where;
    expect(whereArg.lifecycleStatus.in).toContain('KYC_APPROVED');
  });

  it('does NOT bump ACTIVE riders — they are past guarantor in the lifecycle', async () => {
    await guarantorRepository.approveGuarantor(RIDER_ID, 'admin-1');

    const whereArg = mockRiderUpdateMany.mock.calls[0][0].where;
    expect(whereArg.lifecycleStatus.in).not.toContain('ACTIVE');
    expect(whereArg.lifecycleStatus.in).not.toContain('PICKUP_SCHEDULED');
  });
});
