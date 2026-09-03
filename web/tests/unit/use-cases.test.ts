/**
 * Use-Case Layer — Unit Tests
 *
 * Tests orchestration logic at the use-case boundary.
 * All dependencies (repositories, services, storage, audit, outbox) are mocked.
 * Prisma is NOT mocked — use-cases call repositories, not Prisma directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ===========================================================================
// Mocks — Repositories
// ===========================================================================

const mockKycRepository = {
  findByRiderId: vi.fn(),
  submitKyc: vi.fn(),
  approveKyc: vi.fn(),
  rejectKyc: vi.fn(),
  requestInfo: vi.fn(),
  savePartialKyc: vi.fn(),
};

const mockGuarantorRepository = {
  findByRiderId: vi.fn(),
  submitGuarantor: vi.fn(),
  approveGuarantor: vi.fn(),
  rejectGuarantor: vi.fn(),
  requestInfo: vi.fn(),
  replaceGuarantor: vi.fn(),
};

const mockWalletRepository = {
  findByRiderId: vi.fn(),
  getTransactions: vi.fn(),
  createTransaction: vi.fn(),
  findTransactionById: vi.fn(),
  findTransactionByKey: vi.fn(),
  updateTransactionStatus: vi.fn(),
};

const mockRentalRepository = {
  findPlans: vi.fn(),
  selectPlan: vi.fn(),
  findActiveRental: vi.fn(),
  startRental: vi.fn(),
  endRental: vi.fn(),
};

const mockSupportRepository = {
  create: vi.fn(),
  findByRiderId: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  addMessage: vi.fn(),
  getFaqs: vi.fn(),
};

// ===========================================================================
// Mocks — Services
// ===========================================================================

const mockWalletLedgerService = {
  credit: vi.fn(),
  creditSecurityDeposit: vi.fn(),
  debit: vi.fn(),
  reverse: vi.fn(),
};

const mockAuditLog = { createAuditLog: vi.fn() };

// ===========================================================================
// Mocks — Shared
// ===========================================================================

const mockDb = {
  rider: { findUnique: vi.fn(), count: vi.fn() },
  vehicle: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
  shift: { findUnique: vi.fn() },
  rentalLease: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  setting: { findUnique: vi.fn() },
  systemSetting: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  supportTicket: { count: vi.fn() },
  // PR-ONBOARDING-2026-08-11 (audit 2.7): audit log writes for KYC
  // review actions read the previous KycProfile state via
  // `db.kycProfile.findUnique` outside the transaction. The mock must
  // include the table.
  kycProfile: { findUnique: vi.fn() },
};

const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

// ===========================================================================
// Mock registrations
// ===========================================================================

vi.mock('@/server/modules/kyc/kyc.repository', () => ({ kycRepository: mockKycRepository }));
vi.mock('@/server/modules/guarantors/guarantor.repository', () => ({
  guarantorRepository: mockGuarantorRepository,
}));
vi.mock('@/server/modules/wallet/wallet.repository', () => ({
  walletRepository: mockWalletRepository,
}));
vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: mockWalletLedgerService,
}));
vi.mock('@/server/modules/rentals/rental.repository', () => ({
  rentalRepository: mockRentalRepository,
  // P1.3: rental.use-cases now imports utcNowHHMM for UTC lease times.
  utcNowHHMM: () => '00:00',
}));
vi.mock('@/server/modules/support/support.repository', () => ({
  supportRepository: mockSupportRepository,
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mockAuditLog.createAuditLog }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: () => Promise.resolve('event-1') },
  OutboxEventTypes: {
    NOTIFICATION_SEND: 'notification.send',
    WALLET_TOPUP_APPROVED: 'wallet.topup.approved',
    WALLET_TOPUP_REJECTED: 'wallet.topup.rejected',
  },
}));
vi.mock('@/lib/notification-service', () => ({
  notificationService: {
    notifyKycStatusChange: () => Promise.resolve(undefined),
    createAndSend: () => Promise.resolve(undefined),
  },
}));
vi.mock('@/lib/dynamic-pricing', () => ({
  calculateDynamicPrice: () => ({
    basePrice: 18000,
    finalPrice: 16000,
    tier: 'off-peak',
    discount: '11%',
    discountLabel: 'Off-peak discount',
    availability: 'High',
  }),
}));
vi.mock('@/lib/flatten-rider', () => ({ flattenRider: (r: any) => r }));
vi.mock('@/lib/sign-rider', () => ({ signRiderUrls: (r: any) => r }));
vi.mock('@/server/modules/deposits/deposit.service', () => ({
  upsertDepositRecord: () => Promise.resolve(undefined),
}));
vi.mock('isomorphic-dompurify', () => ({
  sanitize: (s: string) => s,
  addHook: () => {},
  isValidTag: () => true,
}));

// ===========================================================================
// Import after mocks
// ===========================================================================

const { kycUseCases } = await import('@/server/modules/kyc/kyc.use-cases');
const { guarantorUseCases } = await import('@/server/modules/guarantors/guarantor.use-cases');
const { walletUseCases } = await import('@/server/modules/wallet/wallet.use-cases');
const { bookRental } = await import('@/server/modules/rentals/use-cases/book-rental.use-case');
const { syncPickup } = await import('@/server/modules/rentals/use-cases/sync-pickup.use-case');
const { RentalBookError } = await import('@/server/modules/rentals/use-cases/errors');
const rentalUseCases = { bookRental, syncPickup };
const { riderSupportUseCases } = await import('@/server/modules/support/rider-support.use-cases');
const { sharedSupportUseCases } = await import('@/server/modules/support/shared-support.use-cases');
const { adminSupportUseCases } = await import('@/server/modules/support/admin-support.use-cases');

// ===========================================================================
// KYC Use Cases
// ===========================================================================

describe('KYC — Submit', () => {
  beforeEach(() => vi.resetAllMocks());

  it('submits full KYC when all critical docs are present', async () => {
    mockKycRepository.findByRiderId.mockResolvedValue(null);
    mockKycRepository.submitKyc.mockResolvedValue({ id: 'kyc-1', status: 'SUBMITTED' });

    const result = await kycUseCases.submitKyc('rider-123', {
      aadhaarFront: 'url-aadhaar-front',
      aadhaarBack: 'url-aadhaar-back',
      panCard: 'url-pan',
      profilePhoto: 'url-photo',
    } as any);

    expect(mockKycRepository.submitKyc).toHaveBeenCalledWith(
      'rider-123',
      expect.objectContaining({
        aadhaarFront: 'url-aadhaar-front',
        aadhaarBack: 'url-aadhaar-back',
        panCard: 'url-pan',
        profilePhoto: 'url-photo',
      })
    );
    expect(result.status).toBe('SUBMITTED');
  });

  it('saves partial KYC when some docs are missing', async () => {
    mockKycRepository.findByRiderId.mockResolvedValue(null);
    mockKycRepository.savePartialKyc.mockResolvedValue({ id: 'kyc-1', status: 'DRAFT' });

    await kycUseCases.submitKyc('rider-123', {
      aadhaarFront: 'url-aadhaar-front',
    } as any);

    expect(mockKycRepository.savePartialKyc).toHaveBeenCalled();
    expect(mockKycRepository.submitKyc).not.toHaveBeenCalled();
  });

  it('merges with existing partial data for full submission decision', async () => {
    // Existing partial data has back, pan, photo — only front is missing
    mockKycRepository.findByRiderId.mockResolvedValue({
      aadhaarBack: 'existing-aadhaar-back',
      panCard: 'existing-pan',
      profilePhoto: 'existing-photo',
    });
    mockKycRepository.submitKyc.mockResolvedValue({ id: 'kyc-1', status: 'SUBMITTED' });

    await kycUseCases.submitKyc('rider-123', {
      aadhaarFront: 'new-aadhaar-front',
    } as any);

    // submitKyc is called with only the new prismaData (not merged)
    // The existing data is only used to decide submit vs partial
    expect(mockKycRepository.submitKyc).toHaveBeenCalledWith(
      'rider-123',
      expect.objectContaining({
        aadhaarFront: 'new-aadhaar-front',
      })
    );
    expect(mockKycRepository.submitKyc).toHaveBeenCalled();
    expect(mockKycRepository.savePartialKyc).not.toHaveBeenCalled();
  });

  it('maps bankAccount → accountNumber and bankIfsc → ifscCode', async () => {
    mockKycRepository.findByRiderId.mockResolvedValue(null);
    mockKycRepository.savePartialKyc.mockResolvedValue({ id: 'kyc-1' });

    await kycUseCases.submitKyc('rider-123', {
      bankAccount: '1234567890',
      bankIfsc: 'SBIN0001234',
    } as any);

    expect(mockKycRepository.savePartialKyc).toHaveBeenCalledWith(
      'rider-123',
      expect.objectContaining({
        accountNumber: '1234567890',
        ifscCode: 'SBIN0001234',
      })
    );
  });
});

describe('KYC — Review (Approve / Reject / Request Info)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('approves KYC', async () => {
    mockKycRepository.approveKyc.mockResolvedValue({ id: 'kyc-1', status: 'APPROVED' });
    mockDb.$transaction.mockImplementation(async (fn: any) => fn({}));

    const result = await kycUseCases.reviewKyc('rider-123', 'admin-1', { action: 'APPROVE' } as any);

    expect(mockKycRepository.approveKyc).toHaveBeenCalledWith('rider-123', 'admin-1');
    expect(result.status).toBe('APPROVED');
  });

  it('rejects KYC with reason', async () => {
    mockKycRepository.rejectKyc.mockResolvedValue({ id: 'kyc-1', status: 'REJECTED' });
    mockDb.$transaction.mockImplementation(async (fn: any) => fn({}));

    await kycUseCases.reviewKyc('rider-123', 'admin-1', {
      action: 'REJECT',
      rejectionReason: 'Blurry document',
    } as any);

    expect(mockKycRepository.rejectKyc).toHaveBeenCalledWith(
      'rider-123',
      'admin-1',
      'Blurry document',
      []
    );
  });

  it('requests additional info', async () => {
    mockKycRepository.requestInfo.mockResolvedValue({ id: 'kyc-1', status: 'INFO_REQUIRED' });

    await kycUseCases.reviewKyc('rider-123', 'admin-1', {
      action: 'REQUEST_INFO',
      infoRequest: 'Please provide clear photo',
    } as any);

    expect(mockKycRepository.requestInfo).toHaveBeenCalledWith(
      'rider-123',
      'admin-1',
      'Please provide clear photo'
    );
  });
});

// ===========================================================================
// Guarantor Use Cases
// ===========================================================================

describe('Guarantor — Submit', () => {
  beforeEach(() => vi.resetAllMocks());

  it('submits guarantor data', async () => {
    mockGuarantorRepository.submitGuarantor.mockResolvedValue({
      id: 'g-1',
      status: 'SUBMITTED',
    });

    const result = await guarantorUseCases.submitGuarantor('rider-123', {
      fullName: 'John Doe',
      phone: '9876543211',
      relationship: 'brother',
      aadhaarFront: 'url-front',
      aadhaarBack: 'url-back',
    } as any);

    expect(mockGuarantorRepository.submitGuarantor).toHaveBeenCalledWith(
      'rider-123',
      expect.objectContaining({
        fullName: 'John Doe',
      })
    );
    expect(result.status).toBe('SUBMITTED');
  });
});

describe('Guarantor — Review', () => {
  beforeEach(() => vi.resetAllMocks());

  it('approves guarantor', async () => {
    mockGuarantorRepository.approveGuarantor.mockResolvedValue({
      id: 'g-1',
      status: 'APPROVED',
    });

    const result = await guarantorUseCases.reviewGuarantor('rider-123', 'admin-1', {
      action: 'APPROVE',
    } as any);

    expect(mockGuarantorRepository.approveGuarantor).toHaveBeenCalledWith('rider-123', 'admin-1');
    expect(result.status).toBe('APPROVED');
  });

  it('rejects guarantor with reason', async () => {
    mockGuarantorRepository.rejectGuarantor.mockResolvedValue({
      id: 'g-1',
      status: 'REJECTED',
    });

    await guarantorUseCases.reviewGuarantor('rider-123', 'admin-1', {
      action: 'REJECT',
      rejectionReason: 'Invalid documents',
    } as any);

    expect(mockGuarantorRepository.rejectGuarantor).toHaveBeenCalledWith(
      'rider-123',
      'admin-1',
      'Invalid documents'
    );
  });

  it('requests info from guarantor', async () => {
    mockGuarantorRepository.requestInfo.mockResolvedValue({
      id: 'g-1',
      status: 'INFO_REQUIRED',
    });

    await guarantorUseCases.reviewGuarantor('rider-123', 'admin-1', {
      action: 'REQUEST_INFO',
      infoRequest: 'Update phone number',
    } as any);

    expect(mockGuarantorRepository.requestInfo).toHaveBeenCalledWith(
      'rider-123',
      'admin-1',
      'Update phone number'
    );
  });
});

// ===========================================================================
// Wallet Use Cases
// ===========================================================================

describe('Wallet — Top-up', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates PENDING transaction for rider', async () => {
    // PR-ONBOARDING-FLOW-2026-08-13: the rank<10 threshold (was <8) means
    // a rank-8 rider (DEPOSIT_APPROVED) is now classified as
    // SECURITY_DEPOSIT, not TOP_UP. To keep this test focused on the
    // "rider at ACTIVE wants to add money" happy path, use a rank >= 10
    // rider so the requested `purpose` flows through unchanged.
    mockDb.rider.findUnique.mockResolvedValue({
      id: 'rider-123',
      depositDone: true,
      phone: '9876543222',
      lifecycleStatus: 'ACTIVE',
    });
    mockWalletRepository.findTransactionByKey.mockResolvedValue(null);
    mockWalletRepository.createTransaction.mockResolvedValue({
      id: 'txn-1',
      status: 'PENDING',
      riderId: 'rider-123',
      amountInPaise: 50000,
    });

    const result = await walletUseCases.requestTopup('rider-123', 50000, 'TOP_UP', 'upi');

    expect(mockWalletRepository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        riderId: 'rider-123',
        amountInPaise: 50000,
        purpose: 'TOP_UP',
        status: 'PENDING',
      })
    );
    expect(result.status).toBe('PENDING');
  });

  it('returns existing transaction for idempotent replay', async () => {
    // Same rank fix as above: a rank-8 rider is now SECURITY_DEPOSIT.
    // The idempotent-replay branch compares the existing txn's purpose
    // against `finalPurpose` (which is SECURITY_DEPOSIT for rank 8),
    // so the test mock must match. Use rank >= 10 to keep the
    // requested `purpose: TOP_UP` flowing through unchanged.
    mockDb.rider.findUnique.mockResolvedValue({
      id: 'rider-123',
      depositDone: true,
      phone: '9876543210',
      lifecycleStatus: 'ACTIVE',
    });
    // The idempotent-replay guard also verifies amount/purpose consistency —
    // the mocked existing row must match the request, or it is a conflict.
    const existingTxn = { id: 'txn-existing', status: 'PENDING', amountInPaise: 50000, purpose: 'TOP_UP' };
    mockWalletRepository.findTransactionByKey.mockResolvedValue(existingTxn);

    const result = await walletUseCases.requestTopup('rider-123', 50000, 'TOP_UP', 'upi');

    expect(result).toBe(existingTxn);
    expect(mockWalletRepository.createTransaction).not.toHaveBeenCalled();
  });

  it('forces SECURITY_DEPOSIT purpose when rider has not deposited', async () => {
    mockDb.rider.findUnique.mockResolvedValue({
      id: 'rider-123',
      depositDone: false,
      phone: '9876543210',
      lifecycleStatus: 'DEPOSIT_PENDING',
    });
    mockWalletRepository.findTransactionByKey.mockResolvedValue(null);
    mockWalletRepository.createTransaction.mockResolvedValue({
      id: 'txn-deposit',
      status: 'PENDING',
      purpose: 'SECURITY_DEPOSIT',
    });

    await walletUseCases.requestTopup('rider-123', 500000, 'TOP_UP', 'upi');

    expect(mockWalletRepository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'SECURITY_DEPOSIT',
      })
    );
  });

  it('throws when rider not found', async () => {
    mockDb.rider.findUnique.mockResolvedValue(null);

    await expect(
      walletUseCases.requestTopup('nonexistent', 50000, 'TOP_UP', 'upi')
    ).rejects.toThrow('Rider not found');
  });
});

describe('Wallet — Approval', () => {
  beforeEach(() => vi.resetAllMocks());

  it('approves PENDING transaction and credits wallet', async () => {
    mockWalletRepository.findTransactionById.mockResolvedValue({
      id: 'txn-1',
      status: 'PENDING',
      riderId: 'rider-123',
      amountInPaise: 50000,
      purpose: 'TOP_UP',
    });
    mockWalletLedgerService.credit.mockResolvedValue(undefined);
    mockWalletRepository.updateTransactionStatus.mockResolvedValue(undefined);
    mockAuditLog.createAuditLog.mockResolvedValue(undefined);

    const mockTx = {
      transaction: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

    await walletUseCases.approveTopup('txn-1', 'admin-1');

    expect(mockWalletLedgerService.credit).toHaveBeenCalledWith(
      expect.objectContaining({
        riderId: 'rider-123',
        amountInPaise: 50000,
        category: 'TOP_UP',
      }),
      mockTx
    );
    expect(mockTx.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'txn-1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedBy: 'admin-1',
        }),
      })
    );
    expect(mockAuditLog.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'wallet.approve_topup',
        entityId: 'txn-1',
      })
    );
  });

  it('blocks double approval (already APPROVED)', async () => {
    mockWalletRepository.findTransactionById.mockResolvedValue({
      id: 'txn-1',
      status: 'APPROVED',
      riderId: 'rider-123',
      amount: 50000,
    });

    await expect(walletUseCases.approveTopup('txn-1', 'admin-1')).rejects.toThrow(
      'already APPROVED'
    );
  });

  it('rejects transaction and logs audit', async () => {
    mockWalletRepository.findTransactionById.mockResolvedValue({
      id: 'txn-1',
      status: 'PENDING',
      riderId: 'rider-123',
      amount: 50000,
    });
    mockWalletRepository.updateTransactionStatus.mockResolvedValue(undefined);
    mockAuditLog.createAuditLog.mockResolvedValue(undefined);
    mockDb.$transaction.mockImplementation(async (fn: any) => fn({}));

    await walletUseCases.rejectTopup('txn-1', 'admin-1', 'Suspicious');

    expect(mockWalletRepository.updateTransactionStatus).toHaveBeenCalledWith(
      'txn-1',
      'REJECTED',
      'admin-1'
    );
    expect(mockAuditLog.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'wallet.reject_topup',
        details: expect.objectContaining({ reason: 'Suspicious' }),
      })
    );
  });

  it('blocks rejection of already-approved transaction', async () => {
    mockWalletRepository.findTransactionById.mockResolvedValue({
      id: 'txn-1',
      status: 'APPROVED',
    });

    await expect(walletUseCases.rejectTopup('txn-1', 'admin-1', 'reason')).rejects.toThrow(
      'already APPROVED'
    );
  });
});

describe('Wallet — Get Wallet', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns wallet with pending top-ups', async () => {
    mockWalletRepository.findByRiderId.mockResolvedValue({
      riderId: 'rider-123',
      balanceInPaise: 100000,
    });
    mockWalletRepository.getTransactions.mockResolvedValue([
      { status: 'PENDING', type: 'CREDIT', amountInPaise: 50000 },
      { status: 'APPROVED', type: 'CREDIT', amountInPaise: 30000 },
    ]);

    const result = await walletUseCases.getWallet('rider-123');

    expect(result).not.toBeNull();
    expect(result!.balancePaise).toBe(100000);
    expect(result!.pendingTopupsPaise).toBe(50000);
  });

  it('returns null when no wallet exists', async () => {
    mockWalletRepository.findByRiderId.mockResolvedValue(null);

    const result = await walletUseCases.getWallet('rider-123');

    expect(result).toBeNull();
  });
});

// ===========================================================================
// Rental Use Cases
// ===========================================================================

describe('Rental — Book Rental', () => {
  beforeEach(() => vi.resetAllMocks());

  const mockVehicle = {
    id: 'v-1',
    status: 'AVAILABLE',
    hubId: 'hub-1',
    hub: { id: 'hub-1', name: 'Koramangala Hub' },
  };

  const mockShift = { id: 's-1', isActive: true, maxBookings: 5 };

  it('books rental with available vehicle', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue(mockVehicle);
    mockDb.shift.findUnique.mockResolvedValue(mockShift);
    mockDb.rentalLease.count.mockResolvedValue(2);
    mockDb.rentalLease.findFirst.mockResolvedValue(null); // no duplicate
    mockDb.vehicle.count.mockResolvedValue(10);
    mockDb.systemSetting.findUnique.mockResolvedValue({ value: '18000' });

    const mockTx = {
      rentalLease: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'lease-1',
          status: 'BOOKED',
          leaseDate: '2026-06-15',
          startTime: '09:00',
          basePrice: 18000,
          finalPrice: 16000,
          vehicle: { id: 'v-1', vehicleId: 'V001', model: 'EV-X' },
          shift: { id: 's-1', name: 'Morning', startTime: '09:00', endTime: '17:00' },
        }),
      },
      vehicle: {
        // PR-ONBOARDING-2026-08-11 (audit 2.11 R3): vehicle flip now uses
        // updateMany with a status guard instead of plain update.
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rider: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

    const result = await rentalUseCases.bookRental('rider-123', {
      vehicleId: 'v-1',
      shiftId: 's-1',
      leaseDate: '2026-06-15',
      startTime: '09:00',
    });

    expect(result.lease.status).toBe('BOOKED');
    // PR-ONBOARDING-2026-08-11 (audit 2.11 R3): vehicle status flip now
    // uses updateMany with a status guard.
    expect(mockTx.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'v-1', status: 'AVAILABLE' },
      data: { status: 'RESERVED' },
    });
  });

  it('throws when vehicle not available', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue({
      ...mockVehicle,
      status: 'ACTIVE_RENTAL',
    });

    await expect(
      rentalUseCases.bookRental('rider-123', {
        vehicleId: 'v-1',
        shiftId: 's-1',
        leaseDate: '2026-06-15',
        startTime: '09:00',
      })
    ).rejects.toThrow(RentalBookError);
  });

  it('throws when shift is fully booked', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue(mockVehicle);
    mockDb.shift.findUnique.mockResolvedValue(mockShift);
    mockDb.vehicle.count.mockResolvedValue(10);
    mockDb.systemSetting.findUnique.mockResolvedValue({ value: '18000' });
    const mockTxFullyBooked = {
      rentalLease: { count: vi.fn().mockResolvedValue(5) },
      vehicle: {},
      rider: {},
    };
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockTxFullyBooked));

    await expect(
      rentalUseCases.bookRental('rider-123', {
        vehicleId: 'v-1',
        shiftId: 's-1',
        leaseDate: '2026-06-15',
        startTime: '09:00',
      })
    ).rejects.toThrow('fully booked');
  });

  it('throws when rider already has booking for same shift/date', async () => {
    mockDb.vehicle.findUnique.mockResolvedValue(mockVehicle);
    mockDb.shift.findUnique.mockResolvedValue(mockShift);
    mockDb.vehicle.count.mockResolvedValue(10);
    mockDb.systemSetting.findUnique.mockResolvedValue({ value: '18000' });
    const mockTxDuplicateRider = {
      rentalLease: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-lease' }),
      },
      vehicle: {},
      rider: {},
    };
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockTxDuplicateRider));

    await expect(
      rentalUseCases.bookRental('rider-123', {
        vehicleId: 'v-1',
        shiftId: 's-1',
        leaseDate: '2026-06-15',
        startTime: '09:00',
      })
    ).rejects.toThrow('already have an active booking');
  });
});

describe('Rental — Sync Pickup', () => {
  beforeEach(() => vi.resetAllMocks());

  it('completes pickup and moves rider to PICKUP_SCHEDULED (active-path async-wait)', async () => {
    mockDb.rider.findUnique.mockResolvedValue({
      id: 'rider-123',
      vehicleId: null,
      kycProfile: {},
      wallet: {},
      guarantor: {},
      vehicleReturns: [],
    });
    mockDb.vehicle.findFirst.mockResolvedValue({
      id: 'v-1',
      vehicleId: 'V001',
      status: 'AVAILABLE',
      hub: { name: 'Koramangala Hub' },
    });

    const mockTx = {
      vehicle: {
        update: vi.fn().mockResolvedValue(undefined),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      rider: {
        // PR-ONBOARDING-2026-08-11 (audit 2.11 R5): syncPickup now uses
        // updateMany with a lifecycle guard, not update. The mock must
        // match.
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'rider-123',
          pickupDone: true,
          // PR-ONBOARDING-FLOW-2026-08-12: the active path keeps the
          // rider at PICKUP_SCHEDULED (rank 10) until admin flips
          // them to ACTIVE. The test was previously asserting ACTIVE
          // here — that is the older synchronous flow. The new
          // flow's mock is `PICKUP_SCHEDULED` + `pickupHub` set on
          // the rider row.
          accountStatus: 'PRE_ACTIVE',
          rentalStatus: 'NONE',
          kycProfile: {},
          wallet: {},
          guarantor: {},
          vehicleReturns: [],
        }),
      },
      rentalLease: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

    const result = await rentalUseCases.syncPickup('rider-123', {
      vehicleId: 'v-1',
    });

    // PR-ONBOARDING-FLOW-2026-08-12: syncPickup now sets
    // lifecycleStatus to PICKUP_SCHEDULED, not ACTIVE. Admin flips
    // the rider to ACTIVE separately (HangTight waits for that
    // transition). The allowlist is unchanged.
    expect(mockTx.rider.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'rider-123',
          lifecycleStatus: expect.objectContaining({
            in: expect.arrayContaining([
              'PICKUP_SCHEDULED',
              'ACTIVE',
              'DEPOSIT_APPROVED',
            ]),
          }),
        }),
        data: expect.objectContaining({
          lifecycleStatus: 'PICKUP_SCHEDULED',
          vehicleId: 'v-1',
        }),
      })
    );
  });

  it('throws when vehicle not found', async () => {
    mockDb.rider.findUnique.mockResolvedValue({ id: 'rider-123' });
    mockDb.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      rentalUseCases.syncPickup('rider-123', { vehicleId: 'nonexistent' })
    ).rejects.toThrow('Vehicle not found');
  });
});

// ===========================================================================
// Support Use Cases
// ===========================================================================

describe('Support — Ticket Flow', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates ticket with generated ticket ID', async () => {
    mockDb.supportTicket.count.mockResolvedValue(42);
    mockSupportRepository.create.mockResolvedValue({
      id: 'ticket-1',
      ticketId: '#0043-A1B2',
      status: 'OPEN',
    });

    const result = await riderSupportUseCases.createTicket('rider-123', {
      subject: 'App crash',
      message: 'App crashes on login',
      category: 'technical',
      priority: 'high',
    } as any);

    expect(result.ticketId).toBe('#0043-A1B2');
    expect(mockSupportRepository.create).toHaveBeenCalledWith(
      'rider-123',
      expect.objectContaining({
        status: 'OPEN',
      })
    );
  });

  it('adds message to ticket', async () => {
    mockSupportRepository.findById.mockResolvedValue({ id: 'ticket-1', status: 'OPEN' });
    mockSupportRepository.addMessage.mockResolvedValue({ id: 'msg-1', ticketId: 'ticket-1' });

    await sharedSupportUseCases.replyToTicket('ticket-1', 'rider-123', 'RIDER', {
      message: 'Still experiencing the issue',
      attachments: [] as string[],
    });

    expect(mockSupportRepository.addMessage).toHaveBeenCalledWith(
      'ticket-1',
      'rider-123',
      'RIDER',
      'Still experiencing the issue',
      []
    );
  });

  it('retrieves rider tickets', async () => {
    mockSupportRepository.findByRiderId.mockResolvedValue([{ id: 'ticket-1', status: 'OPEN' }]);

    const result = await riderSupportUseCases.getTickets('rider-123');

    expect(result).toHaveLength(1);
  });

  it('retrieves FAQs', async () => {
    mockSupportRepository.getFaqs.mockResolvedValue([
      { id: 'faq-1', question: 'How to top up?', category: 'wallet' },
    ]);

    const result = await riderSupportUseCases.getFAQs();

    expect(result).toHaveLength(1);
  });
});

// ===========================================================================
// Support — Audit Log
// ===========================================================================

describe('Support — Admin Audit', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates audit log for admin ticket actions', async () => {
    mockAuditLog.createAuditLog.mockResolvedValue(undefined);

    await adminSupportUseCases.logAdminAction('admin-1', {
      action: 'ticket.assign',
      ticketId: 'ticket-1',
      details: { assignedTo: 'admin-2' },
    });

    expect(mockAuditLog.createAuditLog).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'ticket.assign',
      entity: 'ticket',
      entityId: 'ticket-1',
      details: { assignedTo: 'admin-2' },
    });
  });
});
