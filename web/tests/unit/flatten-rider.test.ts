import { flattenRider } from '../../src/lib/flatten-rider';

describe('Phase 1: API Contract Testing (flattenRider)', () => {
  const mockRider: any = {
    id: 'cmnhlwuja0000ubnl0ef4ryzg',
    fullName: 'John Doe',
    phone: '9876543210',
    email: 'john@example.com',
    rentalStatus: 'ACTIVE',
    vehicleReturns: [],
    kycProfile: {
      status: 'VERIFIED',
      profilePhoto: 'https://example.com/photo.jpg',
      accountNumber: '1234567890',
      ifscCode: 'HDFC0001234',
      bankName: 'HDFC Bank',
    },
    wallet: {
      balanceInPaise: 50050, // ₹500.50
      securityDepositInPaise: 25000, // ₹250.00
      depositStatus: 'PAID',
      paymentStreak: 5,
    },
    guarantor: {
      status: 'APPROVED',
      name: 'Jane Doe',
      relation: 'Mother',
      phone: '9999999999',
    },
    currentPlan: 'WEEKLY_LITE',
    planStatus: 'ACTIVE',
    planStartDate: new Date('2026-05-01').toISOString(),
    planEndDate: new Date('2026-05-08').toISOString(),
  };

  test('should correctly flatten wallet fields (paise to rupees)', () => {
    const flat = flattenRider(mockRider);
    expect(flat.walletBalance).toBe(500.5);
    expect(flat.balance).toBe(500.5);
    expect(flat.securityDeposit).toBe(250);
    expect(flat.depositStatus).toBe('PAID');
  });

  test('should correctly map KYC alias fields for frontend compatibility', () => {
    const flat = flattenRider(mockRider);
    expect(flat.kycStatus).toBe('VERIFIED');
    // PR-5 (RIDER_DASHBOARD P0-3 PII strip): account fields are masked in
    // the flattened payload — only the last 4 digits survive.
    expect(flat.bankAccount).toBe('******7890');
    expect(flat.bankIfsc).toBe('HDFC0001234');
    expect(flat.accountNumber).toBe('******7890');
  });

  test('should correctly flatten guarantor fields', () => {
    const flat = flattenRider(mockRider);
    expect(flat.guarantorStatus).toBe('APPROVED');
    expect(flat.guarantorName).toBe('Jane Doe');
    expect(flat.guarantorRelation).toBe('Mother');
  });

  test('should handle missing relations with default values', () => {
    const minimalRider: any = {
      fullName: 'Minimal Rider',
      vehicleReturns: [],
      kycProfile: null,
      wallet: null,
      guarantor: null,
    };
    const flat = flattenRider(minimalRider);
    expect(flat.kycStatus).toBe('PENDING');
    expect(flat.walletBalance).toBe(0);
    expect(flat.guarantorStatus).toBe('PENDING');
    expect(flat.returnPending).toBe(false);
  });

  test('should detect pending returns correctly', () => {
    const riderWithReturn: any = {
      ...mockRider,
      vehicleReturns: [{ status: 'SUBMITTED' }],
    };
    const flat = flattenRider(riderWithReturn);
    expect(flat.returnPending).toBe(true);
  });

  // PR-2026-08-16: the data-deletion queue needs to tell "pending 7-day
  // window" (deletedAt set, purgedAt null) from "purged" (purgedAt set).
  // flattenRider spreads the raw rider row, so the deletion markers must
  // survive flattening untouched for the admin queue UI to read them.
  test('should pass through deletion-state markers (deletedAt/purgedAt)', () => {
    const pending: any = {
      ...mockRider,
      deletedAt: '2026-08-10T00:00:00.000Z',
      purgedAt: null,
    };
    const purged: any = {
      ...mockRider,
      deletedAt: '2026-08-01T00:00:00.000Z',
      purgedAt: '2026-08-08T00:00:00.000Z',
    };

    const flatPending = flattenRider(pending);
    expect(flatPending.deletedAt).toBe('2026-08-10T00:00:00.000Z');
    expect(flatPending.purgedAt).toBeNull();

    const flatPurged = flattenRider(purged);
    expect(flatPurged.deletedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(flatPurged.purgedAt).toBe('2026-08-08T00:00:00.000Z');
  });

  test('P0-S1: should never leak lockPasswordHash, fcmToken, or tokenVersion', () => {
    const sensitiveRider: any = {
      ...mockRider,
      lockPasswordHash: '$2b$10$abcdef1234567890abcdef1234567890abcdef1234567890',
      fcmToken: 'fcm-secret-push-token-12345',
      tokenVersion: 4,
    };

    const flat = flattenRider(sensitiveRider) as any;
    expect(flat.lockPasswordHash).toBeUndefined();
    expect(flat.fcmToken).toBeUndefined();
    expect(flat.tokenVersion).toBeUndefined();
  });
});
