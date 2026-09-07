import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

// NET-005 follow-up-7 (2026-09-08): the KYC queue's
// "PENDING" filter must include riders who haven't started
// KYC submission at all. Self-signup creates a Rider row
// but no KycProfile row (see auth.use-cases.ts:154), so
// the relation filter `where.kycProfile = { status:
// 'PENDING' }` returns zero rows for them — the queue
// silently drops them. The fix broadens the PENDING filter
// to: KycProfile is null, OR status PENDING, OR status
// DRAFT (the KYC state machine's starting state).

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/storage', () => ({
  getStorageProvider: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// A rider who self-signed up but never opened the KYC
// flow — has a Rider row but NO KycProfile row.
const selfSignedUpRider = {
  id: 'rider-selfsignedup',
  riderId: 'R0001',
  fullName: 'New Rider',
  phone: '9000000001',
  lifecycleStatus: 'NEW',
  deletedAt: null,
  purgedAt: null,
  kycProfile: null,
  wallet: { balanceInPaise: 0 },
  guarantor: null,
  vehicleReturns: [],
  createdAt: new Date('2026-08-10T00:00:00.000Z'),
  updatedAt: new Date('2026-08-10T00:00:00.000Z'),
};

// A rider whose KycProfile row exists at the DB-default
// status (PENDING). The row was created by the admin-side
// createRider path or by an explicit transition.
const pendingRowRider = {
  id: 'rider-pendingrow',
  riderId: 'R0002',
  fullName: 'Pending Row Rider',
  phone: '9000000002',
  lifecycleStatus: 'KYC_SUBMITTED',
  deletedAt: null,
  purgedAt: null,
  kycProfile: { status: 'PENDING' },
  wallet: { balanceInPaise: 0 },
  guarantor: null,
  vehicleReturns: [],
  createdAt: new Date('2026-08-09T00:00:00.000Z'),
  updatedAt: new Date('2026-08-09T00:00:00.000Z'),
};

// A rider whose KycProfile row is at the KYC state
// machine's starting state (DRAFT). The state machine
// starts at DRAFT; the DB default is PENDING. The fix
// includes DRAFT in the queue's "not yet reviewed" set.
const draftRowRider = {
  id: 'rider-draftrow',
  riderId: 'R0003',
  fullName: 'Draft Row Rider',
  phone: '9000000003',
  lifecycleStatus: 'KYC_SUBMITTED',
  deletedAt: null,
  purgedAt: null,
  kycProfile: { status: 'DRAFT' },
  wallet: { balanceInPaise: 0 },
  guarantor: null,
  vehicleReturns: [],
  createdAt: new Date('2026-08-08T00:00:00.000Z'),
  updatedAt: new Date('2026-08-08T00:00:00.000Z'),
};

// A rider who has moved past the queue — already
// submitted. Should NOT appear in the PENDING filter.
const submittedRider = {
  id: 'rider-submitted',
  riderId: 'R0004',
  fullName: 'Submitted Rider',
  phone: '9000000004',
  lifecycleStatus: 'KYC_SUBMITTED',
  deletedAt: null,
  purgedAt: null,
  kycProfile: { status: 'SUBMITTED' },
  wallet: { balanceInPaise: 0 },
  guarantor: null,
  vehicleReturns: [],
  createdAt: new Date('2026-08-07T00:00:00.000Z'),
  updatedAt: new Date('2026-08-07T00:00:00.000Z'),
};

describe('adminRiderUseCases.list — KYC queue (pending filter includes self-signup riders)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('kycStatus="PENDING" filter matches riders with no KycProfile row (self-signup)', async () => {
    vi.mocked(db.rider.findMany).mockResolvedValue([] as any);
    vi.mocked(db.rider.count).mockResolvedValue(0);

    await adminRiderUseCases.list({
      search: '',
      state: '',
      kycStatus: 'PENDING',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
      deleted: false,
    });

    const where = (vi.mocked(db.rider.findMany).mock.calls[0][0] as any).where;
    // The fix: the PENDING filter is an OR of three
    // sub-filters — no row, PENDING, DRAFT.
    expect(where.OR).toBeDefined();
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { kycProfile: null },
        { kycProfile: { status: 'PENDING' } },
        { kycProfile: { status: 'DRAFT' } },
      ])
    );
  });

  it('kycStatus="SUBMITTED" filter keeps the existing single-field shape', async () => {
    // For non-PENDING filters, the rider has a row by
    // definition (they reached this state by submitting).
    // The single-field filter is correct and unchanged.
    vi.mocked(db.rider.findMany).mockResolvedValue([] as any);
    vi.mocked(db.rider.count).mockResolvedValue(0);

    await adminRiderUseCases.list({
      search: '',
      state: '',
      kycStatus: 'SUBMITTED',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
      deleted: false,
    });

    const where = (vi.mocked(db.rider.findMany).mock.calls[0][0] as any).where;
    expect(where.kycProfile).toEqual({ status: 'SUBMITTED' });
    expect(where.OR).toBeUndefined();
  });

  it('kycStatus="REJECTED" filter keeps the existing single-field shape', async () => {
    vi.mocked(db.rider.findMany).mockResolvedValue([] as any);
    vi.mocked(db.rider.count).mockResolvedValue(0);

    await adminRiderUseCases.list({
      search: '',
      state: '',
      kycStatus: 'REJECTED',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
      deleted: false,
    });

    const where = (vi.mocked(db.rider.findMany).mock.calls[0][0] as any).where;
    expect(where.kycProfile).toEqual({ status: 'REJECTED' });
    expect(where.OR).toBeUndefined();
  });

  it('PENDING filter returns all 3 "not yet reviewed" riders in one call', async () => {
    // Integration: mock the DB to return the 3 PENDING
    // riders and 1 SUBMITTED rider. The list() call
    // processes the mocked rows; the assertion is on
    // the filter shape (covered above) and the result
    // structure.
    vi.mocked(db.rider.findMany).mockResolvedValue([
      selfSignedUpRider,
      pendingRowRider,
      draftRowRider,
      submittedRider,
    ] as any);
    vi.mocked(db.rider.count).mockResolvedValue(4);

    const result = await adminRiderUseCases.list({
      search: '',
      state: '',
      kycStatus: 'PENDING',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortDir: 'desc',
      deleted: false,
    });

    // The use case returns all rows the DB gave it
    // (filtering is a DB-side concern; this test just
    // exercises the call shape). The list() result must
    // include all 4 rows; the application-side "PENDING
    // only" filter is the DB's OR.
    expect(result.riders).toHaveLength(4);

    // The query was made with the broadened filter.
    const where = (vi.mocked(db.rider.findMany).mock.calls[0][0] as any).where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { kycProfile: null },
        { kycProfile: { status: 'PENDING' } },
        { kycProfile: { status: 'DRAFT' } },
      ])
    );
  });
});
