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
      securityDeposit: 25000, // ₹250.00
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
    expect(flat.bankAccount).toBe('1234567890');
    expect(flat.bankIfsc).toBe('HDFC0001234');
    expect(flat.accountNumber).toBe('1234567890');
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
});
