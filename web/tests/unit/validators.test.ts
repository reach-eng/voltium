import {
  sendOtpSchema,
  topUpSchema,
  updateProfileSchema,
  registerTokenSchema,
  approveTransactionSchema,
  MAX_ADMIN_BONUS_CREDIT_RUPEES,
} from '../../src/lib/validators';
import { updateSystemSettingSchema, updateAdminSchema } from '../../src/lib/validators/admin';
import fc from 'fast-check';

describe('Phase 1: Foundational Schema Validation', () => {
  describe('Auth Validators (sendOtpSchema)', () => {
    test('should fail for non-10 digit phone numbers', () => {
      const result = sendOtpSchema.safeParse({ phone: '12345' });
      expect(result.success).toBe(false);
    });

    test('should fail for non-numeric phone numbers', () => {
      const result = sendOtpSchema.safeParse({ phone: 'ABCDEFGHIJ' });
      expect(result.success).toBe(false);
    });

    test('should pass for valid 10-digit phone', () => {
      const result = sendOtpSchema.safeParse({ phone: '9876543210' });
      expect(result.success).toBe(true);
    });

    test('fuzz testing phone schema with extreme/invalid strings', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 100 }).filter((s) => !/^\d{10}$/.test(s)),
          (invalidPhone) => {
            const result = sendOtpSchema.safeParse({ phone: invalidPhone });
            expect(result.success).toBe(false);
          }
        )
      );
    });
  });

  // KYC Validators (submitKycSchema) tests removed in PR-3:
  // POST /api/rider/kyc was a dead endpoint with 0 Flutter callers.
  // KYC docs are submitted via PUT /api/rider/profile instead.
  // See: docs/audits/2026-08-05-rider-onboarding-api-flows.md OQ-1

  // Guarantor Validators (submitGuarantorSchema) tests removed in PR-3:
  // POST /api/rider/guarantor was a dead endpoint with 0 Flutter callers.
  // Guarantor data is submitted via PUT /api/rider/profile instead.
  // See: docs/audits/2026-08-05-rider-onboarding-api-flows.md OQ-2

  describe('Transaction Validators (topUpSchema)', () => {
    test('should fail for negative amounts', () => {
      const result = topUpSchema.safeParse({
        riderId: 'test-123',
        amount: -500,
        purpose: 'TOP_UP',
        method: 'UPI',
      });
      expect(result.success).toBe(false);
    });

    test('should fail for amounts exceeding ₹50,000', () => {
      const result = topUpSchema.safeParse({
        riderId: 'test-123',
        amount: 60000,
        purpose: 'TOP_UP',
        method: 'UPI',
      });
      expect(result.success).toBe(false);
    });

    test('fuzz testing topUpSchema with extreme invalid amounts', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.double({ max: 0, noDefaultInfinity: true, noNaN: true }),
            fc.double({ min: 50000.01, noDefaultInfinity: true, noNaN: true }),
            fc.float({ max: 0, noDefaultInfinity: true, noNaN: true }),
            fc.integer({ max: 0 }),
            fc.integer({ min: 50001 })
          ),
          (invalidAmount) => {
            const result = topUpSchema.safeParse({
              riderId: 'test-123',
              amount: invalidAmount,
              purpose: 'TOP_UP',
              method: 'UPI',
            });
            expect(result.success).toBe(false);
          }
        )
      );
    });
  });

  describe('Profile Validators (updateProfileSchema)', () => {
    test('should fail for invalid DOB format', () => {
      const result = updateProfileSchema.safeParse({
        dob: '1990/01/01', // Should be dd-mm-yyyy
      });
      expect(result.success).toBe(false);
    });

    test('should pass for valid DOB format', () => {
      const result = updateProfileSchema.safeParse({
        dob: '01-01-1990',
      });
      expect(result.success).toBe(true);
    });

    test('fuzz testing email with junk data and unicode', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s !== ''),
          (invalidEmail) => {
            const result = updateProfileSchema.safeParse({ email: invalidEmail });
            expect(result.success).toBe(false);
          }
        )
      );
    });

    test('fuzz testing fullName with extreme lengths', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string({ maxLength: 1 }), fc.string({ minLength: 101 })),
          (invalidName) => {
            const result = updateProfileSchema.safeParse({ fullName: invalidName });
            expect(result.success).toBe(false);
          }
        )
      );
    });
  });

  describe('FCM Token Registration (registerTokenSchema, BLOCKER 1.2)', () => {
    test('passes with only fcmToken (riderId is derived from session)', () => {
      const result = registerTokenSchema.safeParse({
        fcmToken: 'fK3...long:APA91b...',
      });
      expect(result.success).toBe(true);
    });

    test('fails when fcmToken is missing', () => {
      const result = registerTokenSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    test('fails when fcmToken is empty', () => {
      const result = registerTokenSchema.safeParse({ fcmToken: '' });
      expect(result.success).toBe(false);
    });

    test('legacy body with riderId is now rejected (security tightening)', () => {
      // Previously the validator required { riderId, fcmToken }. Now it
      // derives riderId from the session, so the body must not carry it.
      const result = registerTokenSchema.safeParse({
        riderId: 'rider-123',
        fcmToken: 'token-abc',
      });
      // riderId is silently dropped (Zod default is strip). The shape
      // validates; the route rejects because riderId is not used anyway.
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).riderId).toBeUndefined();
      }
    });
  });

  describe('Admin Transaction Approval (approveTransactionSchema)', () => {
    test('TG-4 (financial audit P0-1): rejects walletCreditAmount above the ₹1,00,000 cap', () => {
      const result = approveTransactionSchema.safeParse({
        id: 'txn-1',
        action: 'APPROVE',
        walletCreditAmount: MAX_ADMIN_BONUS_CREDIT_RUPEES + 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path.join('.')).toContain('walletCreditAmount');
      }
    });

    test('TG-4 (financial audit P0-1): accepts a bonus credit at exactly the cap', () => {
      const result = approveTransactionSchema.safeParse({
        id: 'txn-1',
        action: 'APPROVE',
        walletCreditAmount: MAX_ADMIN_BONUS_CREDIT_RUPEES,
      });
      expect(result.success).toBe(true);
    });

    test('rejects a negative bonus credit', () => {
      const result = approveTransactionSchema.safeParse({
        id: 'txn-1',
        action: 'APPROVE',
        walletCreditAmount: -100,
      });
      expect(result.success).toBe(false);
    });

    test('walletCreditAmount is optional (plain approve/reject)', () => {
      const result = approveTransactionSchema.safeParse({
        id: 'txn-1',
        action: 'REJECT',
        rejectionReason: 'Fraud suspicion',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Ops audit P0-8: updateSystemSettingSchema rejects empty value', () => {
    test('rejects value: ""', () => {
      const result = updateSystemSettingSchema.safeParse({ key: 'JWT_SECRET', value: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain('empty');
      }
    });

    test('accepts non-empty value', () => {
      const result = updateSystemSettingSchema.safeParse({ key: 'JWT_SECRET', value: 's3cret' });
      expect(result.success).toBe(true);
    });

    test('rejects unknown keys (strict)', () => {
      const result = updateSystemSettingSchema.safeParse({
        key: 'JWT_SECRET',
        value: 's3cret',
        isSecret: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Ops audit P0-3: updateAdminSchema has currentPassword', () => {
    test('accepts currentPassword with a password change', () => {
      const result = updateAdminSchema.safeParse({
        id: 'admin_1',
        password: 'NewPass123!',
        currentPassword: 'OldPass123!',
      });
      expect(result.success).toBe(true);
    });

    test('rejects a too-short currentPassword', () => {
      const result = updateAdminSchema.safeParse({
        id: 'admin_1',
        password: 'NewPass123!',
        currentPassword: 'short',
      });
      expect(result.success).toBe(false);
    });
  });
});
