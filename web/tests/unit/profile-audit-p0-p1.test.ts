import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiderValidationError } from '@/server/modules/riders/rider-lifecycle.service';

const mockTx = {
  rider: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  kycProfile: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  guarantor: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  vehicleReturn: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  vehicle: {
    findUnique: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockTx)),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: vi.fn((_id, fn) => fn()),
  invalidateRiderCache: vi.fn(),
}));

import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { db } from '@/lib/db';

describe('Profile Audit P0 & P1 Unit Tests', () => {
  const riderId = 'test-rider-cm123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('KYC Cosmetic vs Identity Rules', () => {
    it('allows cosmetic profilePhoto updates when KYC is APPROVED without changing status to SUBMITTED', async () => {
      // 1. Initial rider lookup before transaction
      (db.rider.findUnique as any).mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'ACTIVE',
      });

      // 2. In-transaction reads
      mockTx.rider.findUnique.mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'ACTIVE',
        kycProfile: {
          status: 'APPROVED',
          profilePhoto: 'https://storage/old.jpg',
        },
      });

      mockTx.kycProfile.findUnique.mockResolvedValue({
        status: 'APPROVED',
        editableFields: [],
      });

      mockTx.kycProfile.upsert.mockResolvedValue({
        id: 'kyc-1',
        riderId,
        profilePhoto: 'https://storage/new.jpg',
        status: 'APPROVED',
      });

      const result = await riderUseCases.updateProfile(riderId, {
        profilePhoto: 'https://storage/new.jpg',
      });

      expect(mockTx.kycProfile.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = mockTx.kycProfile.upsert.mock.calls[0][0];
      expect(upsertArgs.update.profilePhoto).toBe('https://storage/new.jpg');
      expect(upsertArgs.update.status).toBe('APPROVED');
      expect(result).toBeDefined();
    });

    it('blocks identity document edits when KYC is APPROVED', async () => {
      (db.rider.findUnique as any).mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'ACTIVE',
      });

      mockTx.rider.findUnique.mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'ACTIVE',
      });

      mockTx.kycProfile.findUnique.mockResolvedValue({
        status: 'APPROVED',
        editableFields: [],
      });

      await expect(
        riderUseCases.updateProfile(riderId, {
          panCard: 'https://storage/new-pan.jpg',
        })
      ).rejects.toThrow(RiderValidationError);

      expect(mockTx.kycProfile.upsert).not.toHaveBeenCalled();
    });

    it('default-denies identity edits on INFO_REQUIRED when editableFields is empty, but permits cosmetic photo', async () => {
      (db.rider.findUnique as any).mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'DEPOSIT_APPROVED',
      });

      mockTx.rider.findUnique.mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'DEPOSIT_APPROVED',
      });

      mockTx.kycProfile.findUnique.mockResolvedValue({
        status: 'INFO_REQUIRED',
        editableFields: [],
      });

      // Identity edit fails
      await expect(
        riderUseCases.updateProfile(riderId, {
          aadhaarFront: 'https://storage/new-front.jpg',
        })
      ).rejects.toThrow(/Only the requested corrections can be resubmitted/);

      // Cosmetic edit succeeds
      mockTx.kycProfile.upsert.mockResolvedValue({
        id: 'kyc-1',
        riderId,
        profilePhoto: 'https://storage/selfie.jpg',
        status: 'INFO_REQUIRED',
      });

      const res = await riderUseCases.updateProfile(riderId, {
        profilePhoto: 'https://storage/selfie.jpg',
      });
      expect(res).toBeDefined();
      expect(mockTx.kycProfile.upsert).toHaveBeenCalledTimes(1);
    });

    it('does not regress lifecycleStatus from DEPOSIT_APPROVED on photo-only updates', async () => {
      (db.rider.findUnique as any).mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'DEPOSIT_APPROVED',
      });

      mockTx.rider.findUnique.mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'DEPOSIT_APPROVED',
      });

      mockTx.kycProfile.findUnique.mockResolvedValue(null); // hadKycRow = false

      await riderUseCases.updateProfile(riderId, {
        profilePhoto: 'https://storage/first-selfie.jpg',
      });

      // Because it was photo-only, it should NOT transition status to PHONE_VERIFIED / PROFILE_SUBMITTED / KYC_SUBMITTED
      expect(mockTx.rider.update).not.toHaveBeenCalled();
    });
  });

  describe('Guarantor No-Op & Surcharge Guards', () => {
    it('treats identical guarantor submissions as no-ops without re-upserting or modifying surcharge', async () => {
      (db.rider.findUnique as any).mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'ACTIVE',
        requiresHigherDeposit: true,
      });

      mockTx.rider.findUnique.mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'ACTIVE',
        requiresHigherDeposit: true,
      });

      mockTx.guarantor.findUnique.mockResolvedValue({
        name: 'Ramesh Sharma',
        phone: '9876500000',
        address: '123 Main St',
        relation: 'Father',
        dob: null,
        aadhaarFront: null,
        aadhaarBack: null,
        pan: null,
        video: null,
        signature: null,
        photo: null,
        fatherName: null,
        motherName: null,
      });

      // Saving unchanged guarantor name, phone, and address
      await riderUseCases.updateProfile(riderId, {
        guarantorName: 'Ramesh Sharma',
        guarantorPhone: '9876500000',
        guarantorAddress: '123 Main St',
      });

      // Guarantor was not upserted, and requiresHigherDeposit was not changed
      expect(mockTx.guarantor.upsert).not.toHaveBeenCalled();
      expect(mockTx.rider.update).not.toHaveBeenCalled();
    });

    it('rejects changed guarantor phone without receipt with RiderValidationError (test gap 1)', async () => {
      (db.rider.findUnique as any).mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'ACTIVE',
      });

      mockTx.rider.findUnique.mockResolvedValue({
        id: riderId,
        phone: '9876543210',
        lifecycleStatus: 'ACTIVE',
      });

      mockTx.guarantor.findUnique.mockResolvedValue({
        name: 'Ramesh Sharma',
        phone: '9876500000',
        address: '123 Main St',
      });

      await expect(
        riderUseCases.updateProfile(riderId, {
          guarantorName: 'Ramesh Sharma',
          guarantorPhone: '9888877777', // changed phone number!
          guarantorAddress: '123 Main St',
          // guarantorPhoneReceipt omitted!
        })
      ).rejects.toThrow(
        'Guarantor phone verification is required. Please verify the new number with OTP first.'
      );
    });
  });
});
