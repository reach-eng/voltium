/**
 * GET /api/rider/kyc — route unit tests
 *
 * Regression test for audit finding 1.9 (PR-ONBOARDING-2026-08-11):
 * the route must read the rider's bank account + IFSC from the Prisma
 * fields `accountNumber` / `ifscCode`, NOT from `bankAccount` / `bankIfsc`
 * (which do not exist on the schema). The previous `(kycProfile as any).bankAccount`
 * cast returned `undefined` at runtime, silently dropping the rider's saved
 * bank details on every KYC re-read.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getKycStatus: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/rider-auth', () => ({ requireRiderSession: mocks.getSession }));
vi.mock('@/server/modules/kyc/kyc.use-cases', () => ({
  kycUseCases: { getKycStatus: mocks.getKycStatus },
}));
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

import { GET } from '@/app/api/rider/kyc/route';

const session = { riderDbId: 'rider-1', phone: '9876543210' };

describe('GET /api/rider/kyc — bank detail regression (PR-ONBOARDING-2026-08-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(session);
  });

  it('returns bankAccount and bankIfsc from Prisma accountNumber/ifscCode fields', async () => {
    mocks.getKycStatus.mockResolvedValue({
      status: 'APPROVED',
      profilePhoto: 'photo-url',
      riderPhoto: 'rider-photo-url',
      signature: 'sig-url',
      aadhaarFront: 'aadhaar-front-url',
      aadhaarBack: 'aadhaar-back-url',
      panCard: 'pan-url',
      bankName: 'State Bank of India',
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      rejectionReason: null,
    });

    const res = await GET(new Request('http://localhost/api/rider/kyc'));
    const body = await res.json();

    expect(res.status).toBe(200);
    // P1-S3: Bank account is masked for rider-facing KYC endpoint
    expect(body.data.bankAccount).toBe('******7890');
    expect(body.data.bankIfsc).toBe('SBIN0001234');
    expect(body.data.bankName).toBe('State Bank of India');
  });

  it('returns null bankAccount and bankIfsc when Prisma fields are null', async () => {
    mocks.getKycStatus.mockResolvedValue({
      status: 'PENDING',
      profilePhoto: null,
      riderPhoto: null,
      signature: null,
      aadhaarFront: null,
      aadhaarBack: null,
      panCard: null,
      bankName: null,
      accountNumber: null,
      ifscCode: null,
      rejectionReason: null,
    });

    const res = await GET(new Request('http://localhost/api/rider/kyc'));
    const body = await res.json();

    expect(body.data.bankAccount).toBeNull();
    expect(body.data.bankIfsc).toBeNull();
  });

  it('returns 401 when no session', async () => {
    mocks.getSession.mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    );

    const res = await GET(new Request('http://localhost/api/rider/kyc'));
    expect(res.status).toBe(401);
  });
});
