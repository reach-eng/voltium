import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  otpCode: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { generateOtp, verifyOtp, clearOtpStore } = await import('@/lib/otp-store');

describe('OTP Storage Layer — Salted Hash Verification (SEC-OTP-002)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.APP_ENV = 'production';
    (process.env as any).NODE_ENV = 'production';
    process.env.OTP_STORE_PROVIDER = 'postgres';
    mockDb.otpCode.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.otpCode.findUnique.mockResolvedValue(null);
  });

  it('stores only salted SHA-256 codeHash in database and never plaintext code', async () => {
    let capturedCreateData: any = null;
    mockDb.otpCode.upsert.mockImplementation(({ create }) => {
      capturedCreateData = create;
      return Promise.resolve({
        id: 'otp_1',
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const generatedCode = await generateOtp('9876543210');

    expect(capturedCreateData).toBeDefined();
    expect(capturedCreateData.phone).toBe('9876543210');
    // codeHash must be present and must be a 64-character SHA-256 hex string
    expect(capturedCreateData.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(capturedCreateData.salt).toMatch(/^[0-9a-f]{32}$/);
    // Crucial: the plaintext OTP code must NOT be stored in any property
    expect(capturedCreateData.code).toBeUndefined();
    expect(capturedCreateData.codeHash).not.toBe(generatedCode);
  });

  it('verifies OTP against salted codeHash in database', async () => {
    const crypto = await import('crypto');
    const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const code = '654321';
    const codeHash = crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');

    mockDb.otpCode.findUnique.mockResolvedValue({
      id: 'otp_1',
      phone: '9876543210',
      codeHash,
      salt,
      expiresAt: new Date(Date.now() + 300000),
      attempts: 0,
      verified: false,
      resendCount: 1,
      lastSentAt: new Date(),
    });

    mockDb.otpCode.update.mockResolvedValue({
      id: 'otp_1',
      attempts: 1,
      verified: true,
    });

    const result = await verifyOtp('9876543210', '654321');
    expect(result.valid).toBe(true);
  });
});
