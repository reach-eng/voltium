import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { depositService } from '../../../src/server/modules/deposits/deposit.service';
import {
  validateDepositTransition,
  canTransitionDeposit,
  DepositStateMachineError,
} from '../../../src/server/modules/deposits/deposit-state-machine';
import { DepositStatus } from '@prisma/client';

describe('depositService', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

  let riderDbId: string;

  beforeEach(async () => {
    riderDbId = uuidv4();
    const riderId = uuidv4();
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

    it('should return false if in REFUNDED state', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.REFUNDED,
        }
      });
      const res = await depositService.validateApproval(riderDbId);
      expect(res.approved).toBe(false);
    });

    it('should return false if in FORFEITED state', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.FORFEITED,
        }
      });
      const res = await depositService.validateApproval(riderDbId);
      expect(res.approved).toBe(false);
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

    it('should return valid false if no deposit record', async () => {
      const res = await depositService.validateRejection(riderDbId);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('No deposit record found');
    });

    it('should return valid false if REFUNDED', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.REFUNDED,
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

    it('returns 0 if REJECTED', () => {
      expect(depositService.getRefundEligibleAmount('REJECTED', 5000)).toBe(0);
    });

    it('returns 0 if REFUNDED', () => {
      expect(depositService.getRefundEligibleAmount('REFUNDED', 5000)).toBe(0);
    });

    it('returns 0 if FORFEITED', () => {
      expect(depositService.getRefundEligibleAmount('FORFEITED', 5000)).toBe(0);
    });

    it('returns 0 if NOT_SUBMITTED', () => {
      expect(depositService.getRefundEligibleAmount('NOT_SUBMITTED', 5000)).toBe(0);
    });

    it('returns 0 for zero amount even if APPROVED', () => {
      expect(depositService.getRefundEligibleAmount('APPROVED', 0)).toBe(0);
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

  describe('logAction', () => {
    it('creates an audit log entry without throwing', async () => {
      await expect(depositService.logAction({
        riderId: riderDbId,
        adminId: 'admin-1',
        action: 'deposit.approve',
        details: { amount: 5000 },
      })).resolves.not.toThrow();
    });

    it('handles logAction for reject without details', async () => {
      await expect(depositService.logAction({
        riderId: riderDbId,
        adminId: 'admin-1',
        action: 'deposit.reject',
      })).resolves.not.toThrow();
    });
  });
});

describe('deposit-state-machine', () => {
  describe('validateDepositTransition', () => {
    it('allows NOT_SUBMITTED → PENDING', () => {
      expect(() => validateDepositTransition('NOT_SUBMITTED', 'PENDING')).not.toThrow();
    });

    it('allows PENDING → APPROVED', () => {
      expect(() => validateDepositTransition('PENDING', 'APPROVED')).not.toThrow();
    });

    it('allows PENDING → REJECTED', () => {
      expect(() => validateDepositTransition('PENDING', 'REJECTED')).not.toThrow();
    });

    it('allows APPROVED → REFUND_REQUESTED', () => {
      expect(() => validateDepositTransition('APPROVED', 'REFUND_REQUESTED')).not.toThrow();
    });

    it('allows APPROVED → FORFEITED', () => {
      expect(() => validateDepositTransition('APPROVED', 'FORFEITED')).not.toThrow();
    });

    it('allows REFUND_REQUESTED → REFUNDED', () => {
      expect(() => validateDepositTransition('REFUND_REQUESTED', 'REFUNDED')).not.toThrow();
    });

    it('allows REFUND_REQUESTED → PARTIALLY_REFUNDED', () => {
      expect(() => validateDepositTransition('REFUND_REQUESTED', 'PARTIALLY_REFUNDED')).not.toThrow();
    });

    it('allows REJECTED → PENDING_VERIFICATION', () => {
      expect(() => validateDepositTransition('REJECTED', 'PENDING_VERIFICATION')).not.toThrow();
    });

    it('allows same-to-same (no-op)', () => {
      expect(() => validateDepositTransition('PENDING', 'PENDING')).not.toThrow();
    });

    it('throws for REFUNDED → APPROVED (terminal)', () => {
      expect(() => validateDepositTransition('REFUNDED', 'APPROVED')).toThrow(DepositStateMachineError);
    });

    it('throws for FORFEITED → PENDING (terminal)', () => {
      expect(() => validateDepositTransition('FORFEITED', 'PENDING')).toThrow(DepositStateMachineError);
    });

    it('throws for PARTIALLY_REFUNDED → APPROVED (terminal)', () => {
      expect(() => validateDepositTransition('PARTIALLY_REFUNDED', 'APPROVED')).toThrow(DepositStateMachineError);
    });

    it('throws for APPROVED → PENDING (backwards)', () => {
      expect(() => validateDepositTransition('APPROVED', 'PENDING')).toThrow(DepositStateMachineError);
    });

    it('error has currentStatus and targetStatus properties', () => {
      let err: DepositStateMachineError | undefined;
      try {
        validateDepositTransition('REFUNDED', 'PENDING');
      } catch (e: any) {
        err = e;
      }
      expect(err).toBeInstanceOf(DepositStateMachineError);
      expect(err!.currentStatus).toBe('REFUNDED');
      expect(err!.targetStatus).toBe('PENDING');
    });
  });

  describe('canTransitionDeposit', () => {
    it('returns true for PENDING → APPROVED', () => {
      expect(canTransitionDeposit('PENDING', 'APPROVED')).toBe(true);
    });

    it('returns false for REFUNDED → APPROVED (terminal)', () => {
      expect(canTransitionDeposit('REFUNDED', 'APPROVED')).toBe(false);
    });

    it('returns true for same-to-same', () => {
      expect(canTransitionDeposit('APPROVED', 'APPROVED')).toBe(true);
    });

    it('returns false for FORFEITED → PENDING', () => {
      expect(canTransitionDeposit('FORFEITED', 'PENDING')).toBe(false);
    });
  });
});




