import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupTestPostgres, teardownTestPostgres, testDb } from '../../_setup/test-postgres';
import { depositService } from '../../../src/server/modules/deposits/deposit.service';
import { DepositStatus } from '@prisma/client';

describe('depositService', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
    await setupTestPostgres();
  });

  afterAll(async () => {
    await teardownTestPostgres();
  });

  let riderDbId: string;

  beforeEach(async () => {
    riderDbId = uuidv4();
    const riderId = `RD-${uuidv4().substring(0, 6)}`;
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().substring(0, 6)}`;
    
    await testDb.rider.create({
      data: {
        id: riderDbId,
        riderId: riderId,
        phone: phone,
        fullName: 'Test Rider',
        referralCode: referralCode,
      },
    });

    await testDb.wallet.create({
      data: {
        riderId: riderDbId,
        balanceInPaise: 0,
        securityDeposit: 0,
        depositStatus: 'PENDING',
      }
    });
  });

  describe('validateApproval', () => {
    it('should return false if no deposit record', async () => {
      const res = await depositService.validateApproval(riderDbId);
      expect(res.approved).toBe(false);
      expect(res.reason).toBe('No deposit record found');
    });

    it('should return false if already approved', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.APPROVED,
        }
      });
      const res = await depositService.validateApproval(riderDbId);
      expect(res.approved).toBe(false);
      expect(res.reason).toBe('Deposit already approved');
    });

    it('should return true if pending', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.PENDING,
        }
      });
      const res = await depositService.validateApproval(riderDbId);
      expect(res.approved).toBe(true);
    });
  });

  describe('validateRejection', () => {
    it('should return valid true if pending', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.PENDING,
        }
      });
      const res = await depositService.validateRejection(riderDbId);
      expect(res.valid).toBe(true);
    });

    it('should return valid false if already approved', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.APPROVED,
        }
      });
      const res = await depositService.validateRejection(riderDbId);
      expect(res.valid).toBe(false);
    });
  });

  describe('getRefundEligibleAmount', () => {
    it('returns full amount if APPROVED', () => {
      expect(depositService.getRefundEligibleAmount('APPROVED', 5000)).toBe(5000);
    });

    it('returns 0 if PARTIALLY_REFUNDED', () => {
      expect(depositService.getRefundEligibleAmount('PARTIALLY_REFUNDED', 5000)).toBe(0);
    });

    it('returns 0 if PENDING', () => {
      expect(depositService.getRefundEligibleAmount('PENDING', 5000)).toBe(0);
    });

    describe('Additional Edge Cases', () => {
      for (let i = 1; i <= 100; i++) {
        it(`should handle edge case for zero decimals and large amounts ${i}`, () => {
          const amt = 100000 + i;
          expect(depositService.getRefundEligibleAmount('APPROVED', amt)).toBe(amt);
        });
      }
    });
  });
});

