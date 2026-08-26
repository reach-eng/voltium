import { describe, it, expect, vi } from 'vitest';
import { validateTransition, RiderLifecycleError } from '@/server/modules/riders/rider-lifecycle.service';
import { validateKycTransition, KycStateError } from '@/server/modules/kyc/kyc-state-machine';
import { encryptPii, decryptPii } from '@/lib/pii-crypto';

describe('Phase W7 — Rider Lifecycle, KYC & Deposit Integrity', () => {
  describe('R-1: Rider Lifecycle State Machine Transitions', () => {
    it('allows valid sequential lifecycle transitions', () => {
      expect(() => validateTransition('NEW', 'PHONE_VERIFIED')).not.toThrow();
      expect(() => validateTransition('PHONE_VERIFIED', 'PROFILE_SUBMITTED')).not.toThrow();
      expect(() => validateTransition('PROFILE_SUBMITTED', 'GUARANTOR_SUBMITTED')).not.toThrow();
      expect(() => validateTransition('GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED')).not.toThrow();
      expect(() => validateTransition('DEPOSIT_APPROVED', 'KYC_SUBMITTED')).not.toThrow();
      expect(() => validateTransition('KYC_SUBMITTED', 'KYC_APPROVED')).not.toThrow();
      expect(() => validateTransition('KYC_APPROVED', 'PICKUP_SCHEDULED')).not.toThrow();
      expect(() => validateTransition('PICKUP_SCHEDULED', 'ACTIVE')).not.toThrow();
    });

    it('rejects illegal state jumps (e.g. NEW -> ACTIVE)', () => {
      expect(() => validateTransition('NEW', 'ACTIVE')).toThrow(RiderLifecycleError);
      expect(() => validateTransition('PHONE_VERIFIED', 'PICKUP_SCHEDULED')).toThrow(RiderLifecycleError);
      expect(() => validateTransition('PROFILE_SUBMITTED', 'ACTIVE')).toThrow(RiderLifecycleError);
      expect(() => validateTransition('CLOSED', 'ACTIVE')).toThrow(RiderLifecycleError);
    });

    it('allows no-op transition (current === target)', () => {
      expect(() => validateTransition('ACTIVE', 'ACTIVE')).not.toThrow();
      expect(() => validateTransition('NEW', 'NEW')).not.toThrow();
    });
  });

  describe('R-2: Admin PII Encryption', () => {
    it('encrypts and decrypts sensitive documents and numbers correctly', () => {
      const aadhaar = '123456789012';
      const encrypted = encryptPii(aadhaar);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(aadhaar);
      expect(encrypted).toMatch(/^v\d+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

      const decrypted = decryptPii(encrypted);
      expect(decrypted).toBe(aadhaar);
    });

    it('handles empty and null PII cleanly', () => {
      expect(encryptPii('')).toBe('');
      expect(encryptPii(null)).toBeNull();
      expect(encryptPii(undefined)).toBeUndefined();
    });
  });

  describe('R-3 & R-4: KYC State Machine & Resubmission Guards', () => {
    it('allows valid KYC progression', () => {
      expect(() => validateKycTransition('DRAFT', 'SUBMITTED')).not.toThrow();
      expect(() => validateKycTransition('SUBMITTED', 'APPROVED')).not.toThrow();
      expect(() => validateKycTransition('SUBMITTED', 'REJECTED')).not.toThrow();
      expect(() => validateKycTransition('SUBMITTED', 'INFO_REQUIRED')).not.toThrow();
      expect(() => validateKycTransition('INFO_REQUIRED', 'SUBMITTED')).not.toThrow();
      expect(() => validateKycTransition('REJECTED', 'SUBMITTED')).not.toThrow();
    });

    it('rejects invalid transitions from terminal states', () => {
      expect(() => validateKycTransition('APPROVED', 'SUBMITTED')).toThrow(KycStateError);
      expect(() => validateKycTransition('EXPIRED', 'APPROVED')).toThrow(KycStateError);
      expect(() => validateKycTransition('DRAFT', 'APPROVED')).toThrow(KycStateError);
    });
  });

  describe('R-5: Pickup Verification Pre-KYC Protection', () => {
    it('allows pickup verification only for PICKUP_SCHEDULED or ACTIVE riders', async () => {
      const { completePickupVerification } = await import(
        '@/server/modules/pickup/use-cases/completeVerification'
      );
      const { PickupVerificationError } = await import('@/server/modules/pickup/use-cases/errors');

      // Unverified pre-KYC states should throw PickupVerificationError
      const invalidStatuses = [
        'NEW',
        'PHONE_VERIFIED',
        'PROFILE_SUBMITTED',
        'KYC_SUBMITTED',
        'GUARANTOR_SUBMITTED',
        'DEPOSIT_PENDING',
      ];

      for (const status of invalidStatuses) {
        // Mock findUnique returning rider with invalid state
        const dbMock = (await import('@/lib/db')).db;
        vi.spyOn(dbMock.rider, 'findUnique').mockResolvedValueOnce({
          id: 'rider-test-id',
          riderId: 'VF-RD-999',
          lifecycleStatus: status,
        } as any);

        await expect(
          completePickupVerification('rider-test-id', {
            vehicleId: 'V100',
            hubId: 'hub-1',
            pickupPhotoFront: 'https://img.com/1.jpg',
            pickupPhotoBack: 'https://img.com/2.jpg',
          })
        ).rejects.toThrow(PickupVerificationError);
      }
    });
  });

  describe('R-6: Deposit Refund Clamping & Partial Refund Lifecycle', () => {
    it('validates refund clamping against total and remaining deposit amount', async () => {
      const { refundDeposit, DepositStateError } = await import('@/server/modules/deposits/deposit-service');
      const dbMock = (await import('@/lib/db')).db;

      // Mock transaction context
      vi.spyOn(dbMock, '$transaction').mockImplementation(async (callback: any) => {
        const txMock = {
          depositRecord: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'dep-1',
              riderId: 'rider-1',
              status: 'APPROVED',
              amountInPaise: 500000, // ₹5,000
              refundedAmountInPaise: 200000, // ₹2,000 already refunded, remaining ₹3,000
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          wallet: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'wallet-1',
              balanceInPaise: 10000,
              securityDepositInPaise: 300000,
            }),
            update: vi.fn().mockResolvedValue({ balanceInPaise: 400000 }),
          },
          walletLedger: {
            create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return callback(txMock);
      });

      // 1. Trying to refund <= 0 should throw
      await expect(
        refundDeposit({
          riderId: 'rider-1',
          adminId: 'admin-1',
          refundAmountInPaise: 0,
        })
      ).rejects.toThrow(DepositStateError);

      // 2. Trying to refund > remaining (₹3,000 available, asking ₹4,000) should throw
      await expect(
        refundDeposit({
          riderId: 'rider-1',
          adminId: 'admin-1',
          refundAmountInPaise: 400000,
        })
      ).rejects.toThrow(DepositStateError);

      // 3. Refunding exact remaining (₹3,000) should succeed
      await expect(
        refundDeposit({
          riderId: 'rider-1',
          adminId: 'admin-1',
          refundAmountInPaise: 300000,
        })
      ).resolves.not.toThrow();
    });
  });
});
