/**
 * Auth OTP & Verify Flow — Unit Tests
 *
 * Tests the auth use-cases layer with mocked dependencies.
 * Covers: OTP send, verify, rate limiting, new rider creation, referral rewards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — module boundaries
// ---------------------------------------------------------------------------

const mockDb = {
  rider: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  wallet: {
    create: vi.fn(),
  },
  reward: {
    create: vi.fn(),
  },
  outboxEvent: {
    create: vi.fn().mockResolvedValue({ id: 'event-123' }),
  },
};

const mockGenerateOtp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockCreateSessionToken = vi.fn();
const mockFlattenRider = vi.fn();
const mockGetFeatureFlags = vi.fn();
const mockJobQueueEnqueue = vi.fn();
const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/otp-store', () => ({
  generateOtp: mockGenerateOtp,
  verifyOtp: mockVerifyOtp,
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  AUTH_RATE_LIMIT: { windowMs: 60_000, maxRequests: 5 },
}));
vi.mock('@/lib/auth', () => ({
  createSessionToken: mockCreateSessionToken,
  SESSION_COOKIE_OPTIONS: {},
}));
vi.mock('@/lib/firebase-admin', () => ({ auth: null }));
vi.mock('@/lib/job-queue', () => ({
  JobQueue: { enqueue: mockJobQueueEnqueue },
  JobTypes: { SEND_SMS: 'SEND_SMS' },
}));
vi.mock('@/lib/flatten-rider', () => ({ flattenRider: mockFlattenRider }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/feature-flags', () => ({ getFeatureFlags: mockGetFeatureFlags }));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { authUseCases, RateLimitError } = await import(
  '@/server/modules/auth/auth.use-cases'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupMocks(overrides?: {
  existingRider?: boolean;
  otpValid?: boolean;
  rateLimitAllowed?: boolean;
}) {
  const {
    existingRider = false,
    otpValid = true,
    rateLimitAllowed = true,
  } = overrides || {};

  mockCheckRateLimit.mockResolvedValue({ allowed: rateLimitAllowed });
  mockGenerateOtp.mockResolvedValue('123456');
  mockVerifyOtp.mockResolvedValue({ valid: otpValid, error: otpValid ? undefined : 'Invalid OTP' });
  mockGetFeatureFlags.mockResolvedValue({ enablePushNotifications: false });
  mockJobQueueEnqueue.mockResolvedValue(undefined);
  mockDb.outboxEvent.create.mockResolvedValue({ id: 'event-123' });

  const mockRider = {
    id: 'rider-db-id-123',
    riderId: 'VF-RD-TEST1234',
    phone: '9876543210',
    fullName: 'Test Rider',
    accountStatus: 'PRE_ACTIVE',
  };

  if (existingRider) {
    mockDb.rider.findUnique.mockResolvedValue(mockRider);
  } else {
    // First call (sendOtp check) returns null, second call (verifyOtp) returns created rider
    mockDb.rider.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockRider);
    mockDb.rider.create.mockResolvedValue(mockRider);
    mockDb.wallet.create.mockResolvedValue({ id: 'wallet-1' });
    mockDb.reward.create.mockResolvedValue({ id: 'reward-1' });
  }

  mockFlattenRider.mockReturnValue({
    ...mockRider,
    kycDone: false,
    pickupDone: false,
  });

  mockCreateSessionToken.mockReturnValue('mock-session-token');

  return mockRider;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth — OTP Send', () => {
  beforeEach(() => vi.resetAllMocks());

  it('generates OTP and returns exists=false for new rider', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    setupMocks({ existingRider: false });

    const result = await authUseCases.sendOtp(
      { phone: '9876543210' },
      { ip: '127.0.0.1', correlationId: 'test-1' }
    );

    expect(result.exists).toBe(false);
    expect(result.otp).toBeDefined();
    expect(mockGenerateOtp).toHaveBeenCalledWith('9876543210');
    expect(mockDb.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'sms.send',
      }),
    }));
    process.env.NODE_ENV = originalEnv;
  });

  it('returns exists=true for existing rider', async () => {
    setupMocks({ existingRider: true });

    const result = await authUseCases.sendOtp(
      { phone: '9876543210' },
      { correlationId: 'test-2' }
    );

    expect(result.exists).toBe(true);
  });

  it('throws RateLimitError when IP rate limit exceeded', async () => {
    setupMocks({ rateLimitAllowed: false });

    await expect(
      authUseCases.sendOtp({ phone: '9876543210' }, { ip: '10.0.0.1' })
    ).rejects.toThrow(RateLimitError);
  });

  it('prepends +91 to 10-digit phone numbers', async () => {
    setupMocks({ existingRider: false });

    await authUseCases.sendOtp(
      { phone: '9876543210' },
      { correlationId: 'test-4' }
    );

    // findUnique is called with the full phone including +91
    expect(mockDb.rider.findUnique).toHaveBeenCalledWith({
      where: { phone: '+919876543210' },
    });
  });

  it('includes OTP in dev mode response', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    setupMocks({ existingRider: false });

    const result = await authUseCases.sendOtp(
      { phone: '9876543210' },
      { correlationId: 'test-5' }
    );

    expect(result.otp).toBe('123456');
    process.env.NODE_ENV = originalEnv;
  });
});

describe('Auth — OTP Verify', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates new rider and session for first-time user', async () => {
    setupMocks({ existingRider: false, otpValid: true });

    const result = await authUseCases.verifyOtp({
      phone: '9876543210',
      otp: '123456',
    });

    expect(result.isNewRider).toBe(true);
    expect(result.token).toBe('mock-session-token');
    expect(result.riderId).toBe('VF-RD-TEST1234');
    expect(mockDb.rider.create).toHaveBeenCalled();
    expect(mockDb.wallet.create).toHaveBeenCalled();
    expect(mockCreateSessionToken).toHaveBeenCalledWith(expect.objectContaining({
      riderId: 'VF-RD-TEST1234',
      phone: '9876543210',
      role: 'rider',
    }));
  });

  it('returns existing rider without creating wallet', async () => {
    setupMocks({ existingRider: true, otpValid: true });

    const result = await authUseCases.verifyOtp({
      phone: '9876543210',
      otp: '123456',
    });

    expect(result.isNewRider).toBe(false);
    expect(mockDb.rider.create).not.toHaveBeenCalled();
    expect(mockDb.wallet.create).not.toHaveBeenCalled();
  });

  it('throws on invalid OTP', async () => {
    setupMocks({ otpValid: false });

    await expect(
      authUseCases.verifyOtp({ phone: '9876543210', otp: '000000' })
    ).rejects.toThrow('Invalid OTP');
  });

  it('awards referral reward when referral code is provided', async () => {
    // Don't use setupMocks — set up mocks manually for this test to control findUnique queue
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockGenerateOtp.mockResolvedValue('123456');
    mockVerifyOtp.mockResolvedValue({ valid: true });
    mockGetFeatureFlags.mockResolvedValue({ enablePushNotifications: false });
    mockJobQueueEnqueue.mockResolvedValue(undefined);
    mockFlattenRider.mockReturnValue({ id: 'rider-db-id-123', kycDone: false, pickupDone: false });
    mockCreateSessionToken.mockReturnValue('mock-token');
    mockDb.wallet.create.mockResolvedValue({ id: 'wallet-1' });
    mockDb.reward.create.mockResolvedValue({ id: 'reward-1' });
    mockDb.rider.create.mockResolvedValue({
      id: 'rider-db-id-123', riderId: 'VF-RD-NEW12345', phone: '9876543210',
    });

    // verifyOtp flow: phone lookup → create → wallet → referrer lookup → reward → relations fetch
    mockDb.rider.findUnique
      .mockResolvedValueOnce(null) // no existing rider by phone
      .mockResolvedValueOnce({ id: 'referrer-db-id', referralCode: 'CODE-ABCD' }) // referrer
      .mockResolvedValueOnce({ // full rider with relations
        id: 'rider-db-id-123', riderId: 'VF-RD-NEW12345', phone: '9876543210',
        kycProfile: null, wallet: null, guarantor: null, vehicleReturns: [],
      });

    await authUseCases.verifyOtp({
      phone: '9876543210',
      otp: '123456',
      referralCode: 'CODE-ABCD',
    });

    expect(mockDb.reward.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'referrer-db-id',
        title: 'Successful Referral',
        points: 500,
      }),
    });
  });

  it('throws when phone and OTP are both missing', async () => {
    await expect(
      authUseCases.verifyOtp({ phone: '', otp: '' })
    ).rejects.toThrow('Phone and OTP are required');
  });
});

describe('Auth — Rate Limiting', () => {
  beforeEach(() => vi.resetAllMocks());

  it('blocks requests when IP rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false });

    await expect(
      authUseCases.sendOtp({ phone: '9876543210' }, { ip: '10.0.0.1' })
    ).rejects.toThrow(RateLimitError);
  });

  it('checks phone rate limit separately', async () => {
    mockCheckRateLimit
      .mockResolvedValueOnce({ allowed: true })  // IP check
      .mockResolvedValueOnce({ allowed: false }); // Phone check

    await expect(
      authUseCases.sendOtp({ phone: '9876543210' }, { ip: '10.0.0.1' })
    ).rejects.toThrow(RateLimitError);
  });
});
