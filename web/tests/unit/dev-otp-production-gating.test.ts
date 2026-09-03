import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

describe('Dev OTP (111111) — Strict Production and Staging Isolation', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb.otpCode.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.otpCode.findUnique.mockResolvedValue(null);
    mockDb.otpCode.upsert.mockResolvedValue({ id: 'otp_1' });
    await clearOtpStore();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('generates random 6-digit OTP in production even if ENABLE_TEST_OTP=true is set', async () => {
    process.env.APP_ENV = 'production';
    (process.env as any).NODE_ENV = 'production';
    process.env.ENABLE_TEST_OTP = 'true';
    process.env.OTP_STORE_PROVIDER = 'postgres';

    const code = await generateOtp('9876543210');

    expect(code).not.toBe('111111');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generates random 6-digit OTP in staging even if ENABLE_TEST_OTP=true is set', async () => {
    process.env.APP_ENV = 'staging';
    (process.env as any).NODE_ENV = 'production';
    process.env.ENABLE_TEST_OTP = 'true';
    process.env.OTP_STORE_PROVIDER = 'postgres';

    const code = await generateOtp('9876543210');

    expect(code).not.toBe('111111');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('rejects dev OTP 111111 in production when entered against unmatching hash', async () => {
    process.env.APP_ENV = 'production';
    (process.env as any).NODE_ENV = 'production';
    process.env.ENABLE_TEST_OTP = 'true';
    process.env.OTP_STORE_PROVIDER = 'postgres';

    // Stored hash is for a real random OTP '849201', NOT '111111'
    const crypto = await import('crypto');
    const salt = 'salt123456789012';
    const realCode = '849201';
    const codeHash = crypto.createHash('sha256').update(`${salt}:${realCode}`).digest('hex');

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
      verified: false,
    });

    const result = await verifyOtp('9876543210', '111111');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid OTP');
  });

  it('generates 111111 only in development mode', async () => {
    process.env.APP_ENV = 'development';
    (process.env as any).NODE_ENV = 'development';
    process.env.ENABLE_TEST_OTP = 'true';
    process.env.OTP_STORE_PROVIDER = 'memory';

    const code = await generateOtp('9876543210');
    expect(code).toBe('111111');
  });
});
