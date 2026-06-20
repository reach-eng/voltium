import {
  sendOtpSchema,
  submitKycSchema,
  topUpSchema,
  updateProfileSchema,
} from '../../src/lib/validators';

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
  });

  describe('KYC Validators (submitKycSchema)', () => {
    test('should fail for invalid Aadhaar format', () => {
      const result = submitKycSchema.safeParse({
        riderId: 'test-123',
        aadhaarNumber: '123456781234', // Missing hyphens
        panNumber: 'ABCDE1234F',
        bankName: 'HDFC',
        bankAccount: '1234567890',
        bankIfsc: 'HDFC0001234',
      });
      expect(result.success).toBe(false);
    });

    test('should fail for invalid PAN format', () => {
      const result = submitKycSchema.safeParse({
        riderId: 'test-123',
        aadhaarNumber: '1234-5678-1234',
        panNumber: 'abcde1234f', // Lowercase
        bankName: 'HDFC',
        bankAccount: '1234567890',
        bankIfsc: 'HDFC0001234',
      });
      expect(result.success).toBe(false);
    });

    test('should fail for invalid IFSC code', () => {
      const result = submitKycSchema.safeParse({
        riderId: 'test-123',
        aadhaarNumber: '1234-5678-1234',
        panNumber: 'ABCDE1234F',
        bankName: 'HDFC',
        bankAccount: '1234567890',
        bankIfsc: 'HDFC_000123', // Invalid format
      });
      expect(result.success).toBe(false);
    });
  });

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
  });
});
