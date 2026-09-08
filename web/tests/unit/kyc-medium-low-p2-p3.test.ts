/**
 * Phase 7 Unit Tests: Medium & Low Polish (P2-2 to P2-8, P3)
 *
 * Tests:
 * 1. P2-3: extractErrorMessage handles structured, nested, string, and fallback errors cleanly.
 * 2. P2-2: Date filter normalization in adminRiderUseCases.list safely handles both ISO and YYYY-MM-DD.
 * 3. P2-8: buildKycQueueUrl correctly routes the 'expired' tab to kycStatus=EXPIRED.
 * 4. P3-1: getKycBadge correctly badges APPROVED, VERIFIED (legacy), and EXPIRED.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractErrorMessage } from '@/lib/extract-error';
import { buildKycQueueUrl } from '@/components/admin/screens/kyc-management/useKyc';
import { getKycBadge } from '@/components/admin/screens/kyc-management/helpers';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

// ---------------------------------------------------------------------------
// Hoisted Mocks for admin-riders.use-cases
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  findMany: vi.fn().mockResolvedValue([]),
  count: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

vi.mock('@/lib/storage', () => ({
  getStorageProvider: vi.fn().mockResolvedValue({
    getPublicUrl: (url: string) => url,
    getSignedUrl: vi.fn().mockResolvedValue('https://signed.url'),
  }),
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({
    enableKYCVerification: true,
    enableGuarantorRequirement: true,
  }),
}));

describe('P2-3: Shared Error Message Extraction (extractErrorMessage)', () => {
  it('extracts message from structured API error object { error: { message: "..." } }', () => {
    const err = {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions to view KYC queue; kyc_view required',
      },
    };
    expect(extractErrorMessage(err)).toBe('Insufficient permissions to view KYC queue; kyc_view required');
  });

  it('extracts code when message is absent in structured error { error: { code: "FORBIDDEN" } }', () => {
    const err = {
      error: {
        code: 'FORBIDDEN',
      },
    };
    expect(extractErrorMessage(err)).toBe('FORBIDDEN');
  });

  it('extracts message from string error object { error: "Rate limit exceeded" }', () => {
    const err = { error: 'Rate limit exceeded' };
    expect(extractErrorMessage(err)).toBe('Rate limit exceeded');
  });

  it('extracts message from top-level message object { message: "Phone already registered" }', () => {
    const err = { message: 'Phone already registered' };
    expect(extractErrorMessage(err)).toBe('Phone already registered');
  });

  it('extracts message from validation details array { details: [{ message: "Field is required" }] }', () => {
    const err = {
      details: [{ message: 'Field is required' }],
    };
    expect(extractErrorMessage(err)).toBe('Field is required');
  });

  it('extracts message from native Error instance', () => {
    const err = new Error('Network timeout');
    expect(extractErrorMessage(err)).toBe('Network timeout');
  });

  it('extracts direct string error', () => {
    expect(extractErrorMessage('Direct error message')).toBe('Direct error message');
  });

  it('uses provided fallback when object contains no message or error property', () => {
    expect(extractErrorMessage({}, 'Custom fallback')).toBe('Custom fallback');
    expect(extractErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
    expect(extractErrorMessage(undefined)).toBe('Operation failed');
  });
});

describe('P2-2: Date Filter Normalization in adminRiderUseCases.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles ISO 8601 endDate without corrupting string into invalid Date', async () => {
    await adminRiderUseCases.list({
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-08T00:00:00.000Z',
      page: 1,
      limit: 20,
    });

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    const callArgs = mocks.findMany.mock.calls[0][0];
    const where = callArgs.where;

    expect(where.createdAt).toBeDefined();
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);

    // gte should match the start date
    expect(where.createdAt.gte.toISOString()).toBe('2026-09-01T00:00:00.000Z');

    // lte should have end-of-day set to 23:59:59.999Z on that date
    expect(where.createdAt.lte.getUTCFullYear()).toBe(2026);
    expect(where.createdAt.lte.getUTCMonth()).toBe(8); // 0-indexed September
    expect(where.createdAt.lte.getUTCDate()).toBe(8);
    expect(where.createdAt.lte.getUTCHours()).toBe(23);
    expect(where.createdAt.lte.getUTCMinutes()).toBe(59);
    expect(where.createdAt.lte.getUTCSeconds()).toBe(59);
    expect(where.createdAt.lte.getUTCMilliseconds()).toBe(999);
  });

  it('handles date-only (YYYY-MM-DD) format correctly', async () => {
    await adminRiderUseCases.list({
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      page: 1,
      limit: 20,
    });

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    const callArgs = mocks.findMany.mock.calls[0][0];
    const where = callArgs.where;

    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);

    expect(where.createdAt.gte.getUTCDate()).toBe(1);
    expect(where.createdAt.lte.getUTCDate()).toBe(5);
    expect(where.createdAt.lte.getUTCHours()).toBe(23);
    expect(where.createdAt.lte.getUTCMilliseconds()).toBe(999);
  });

  it('ignores invalid dates cleanly without generating NaN timestamps in where filter', async () => {
    await adminRiderUseCases.list({
      startDate: 'not-a-date',
      endDate: 'invalid-end-date',
      page: 1,
      limit: 20,
    });

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    const callArgs = mocks.findMany.mock.calls[0][0];
    const where = callArgs.where;

    // createdAt filter should not have invalid dates
    expect(where.createdAt).toBeUndefined();
  });
});

describe('P2-8: Expired Queue Tab URL Building (buildKycQueueUrl)', () => {
  it('builds URL with kycStatus=EXPIRED when tab is expired', () => {
    const url = buildKycQueueUrl({
      tab: 'expired',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: 20,
    });

    expect(url).toBe('/api/admin/riders?limit=20&page=1&kycStatus=EXPIRED');
  });

  it('includes date filters alongside expired tab', () => {
    const url = buildKycQueueUrl({
      tab: 'expired',
      startDate: '2026-01-01',
      endDate: '2026-09-08',
      page: 2,
      pageSize: 20,
    });

    expect(url).toContain('kycStatus=EXPIRED');
    expect(url).toContain('startDate=2026-01-01');
    expect(url).toContain('endDate=2026-09-08');
    expect(url).toContain('page=2');
  });
});

describe('P3-1: KYC Badge Resolution (getKycBadge)', () => {
  it('returns emerald style for APPROVED and legacy VERIFIED', () => {
    const approvedBadge = getKycBadge('APPROVED');
    const verifiedBadge = getKycBadge('VERIFIED');

    expect(approvedBadge).toContain('text-emerald-600');
    expect(verifiedBadge).toContain('text-emerald-600');
    expect(approvedBadge).toBe(verifiedBadge);
  });

  it('returns distinct slate style for EXPIRED', () => {
    const expiredBadge = getKycBadge('EXPIRED');
    expect(expiredBadge).toContain('text-slate-600');
    expect(expiredBadge).toContain('border-slate-500');
  });

  it('returns fallback style for unknown status', () => {
    const unknownBadge = getKycBadge('UNKNOWN_STATUS');
    expect(unknownBadge).toBe('border-border text-muted-foreground bg-muted/30');
  });
});
