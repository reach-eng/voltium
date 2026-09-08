import { describe, it, expect } from 'vitest';
import { verifyPhoneSchema } from '@/lib/validators';
import { issueVerifyReceipt, verifyVerifyReceipt } from '@/lib/verify-receipt';

/**
 * EDIT-PROFILE-AUDIT P0-2:
 * Issuance canonicality is enforced at the route schema (`verifyPhoneSchema`),
 * not inside `issueVerifyReceipt` (which is format-agnostic by design for pickup reuse).
 * This test pins the composition:
 * - Formatted or spaced variants (+919..., 91 98765 ..., etc.) fail schema validation (400).
 * - Exact 10-digit phone succeeds and produces an HMAC-signed receipt that verifies for that string.
 */
describe('Verify Phone Route Schema & Receipt Issuance Contract (P0-2)', () => {
  it('rejects +91 prefix and spaced phone numbers at schema boundary', () => {
    const prefixed = verifyPhoneSchema.safeParse({ phone: '+919876543210', otp: '123456' });
    expect(prefixed.success).toBe(false);

    const spaced1 = verifyPhoneSchema.safeParse({ phone: '91 98765 43210', otp: '123456' });
    expect(spaced1.success).toBe(false);

    const spaced2 = verifyPhoneSchema.safeParse({ phone: '98765 43210', otp: '123456' });
    expect(spaced2.success).toBe(false);

    const alpha = verifyPhoneSchema.safeParse({ phone: '98765abcde', otp: '123456' });
    expect(alpha.success).toBe(false);

    const invalidOtp = verifyPhoneSchema.safeParse({ phone: '9876543210', otp: '123' });
    expect(invalidOtp.success).toBe(false);
  });

  it('accepts exact 10 digits and issues verifiable receipt', () => {
    const valid = verifyPhoneSchema.safeParse({ phone: '9876543210', otp: '123456' });
    expect(valid.success).toBe(true);
    if (!valid.success) return;

    const receipt = issueVerifyReceipt(valid.data.phone);
    expect(typeof receipt).toBe('string');
    expect(receipt.length).toBeGreaterThan(20);

    const verifyResult = verifyVerifyReceipt(receipt, valid.data.phone);
    expect(verifyResult.valid).toBe(true);

    // Mismatched phone or +91 must not verify with this receipt
    expect(verifyVerifyReceipt(receipt, '+919876543210').valid).toBe(false);
    expect(verifyVerifyReceipt(receipt, '9876543211').valid).toBe(false);
  });
});
