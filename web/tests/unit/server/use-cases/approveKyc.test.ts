/**
 * approveKyc use-case unit tests (PR-26b, API N3)
 *
 * Verifies the use case:
 *   - rejects when KYC is not in SUBMITTED state
 *   - rejects when no KYC profile exists
 *   - delegates to kycRepository.approveKyc
 *   - writes a non-blocking audit log (the "carry-over" fix)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindByRiderId = vi.fn();
const mockApproveKycRepo = vi.fn();
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

vi.mock('@/server/modules/kyc/kyc.repository', () => ({
  kycRepository: {
    findByRiderId: mockFindByRiderId,
    approveKyc: mockApproveKycRepo,
  },
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mockAuditLog }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

const { approveKyc } = await import('@/server/modules/kyc/use-cases/approveKyc');
const { KycApproveError } = await import('@/server/modules/kyc/use-cases/errors');

const SUBMITTED_KYC = { id: 'kyc-1', riderId: 'rider-1', status: 'SUBMITTED' };

describe('approveKyc use case — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByRiderId.mockResolvedValue(SUBMITTED_KYC);
    mockApproveKycRepo.mockResolvedValue({ id: 'kyc-1', status: 'APPROVED' });
  });

  it('approves a SUBMITTED KYC and returns the new status', async () => {
    const result = await approveKyc('rider-1', 'admin-1');

    expect(result).toEqual({ id: 'kyc-1', status: 'APPROVED', riderId: 'rider-1' });
    expect(mockApproveKycRepo).toHaveBeenCalledWith('rider-1', 'admin-1');
  });

  it('writes an audit log entry (kyc.approved) — the carry-over fix', async () => {
    await approveKyc('rider-1', 'admin-1');

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        actorType: 'ADMIN',
        action: 'kyc.approved',
        entity: 'KycProfile',
        entityId: 'kyc-1',
        details: expect.objectContaining({
          riderId: 'rider-1',
          previousStatus: 'SUBMITTED',
          newStatus: 'APPROVED',
        }),
      })
    );
  });
});

describe('approveKyc use case — precondition failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws KycApproveError(MISSING_ACTOR) when approvedBy is empty', async () => {
    await expect(approveKyc('rider-1', '')).rejects.toMatchObject({
      name: 'KycApproveError',
      code: 'MISSING_ACTOR',
    });

    expect(mockFindByRiderId).not.toHaveBeenCalled();
    expect(mockApproveKycRepo).not.toHaveBeenCalled();
  });

  it('throws KycApproveError(NOT_FOUND) when no KYC profile exists', async () => {
    mockFindByRiderId.mockResolvedValue(null);

    await expect(approveKyc('rider-1', 'admin-1')).rejects.toMatchObject({
      name: 'KycApproveError',
      code: 'NOT_FOUND',
    });

    expect(mockApproveKycRepo).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('throws KycApproveError(INVALID_STATE) when KYC is DRAFT', async () => {
    mockFindByRiderId.mockResolvedValue({ ...SUBMITTED_KYC, status: 'DRAFT' });

    await expect(approveKyc('rider-1', 'admin-1')).rejects.toMatchObject({
      name: 'KycApproveError',
      code: 'INVALID_STATE',
    });

    expect(mockApproveKycRepo).not.toHaveBeenCalled();
  });

  it('throws KycApproveError(INVALID_STATE) when KYC is already APPROVED', async () => {
    mockFindByRiderId.mockResolvedValue({ ...SUBMITTED_KYC, status: 'APPROVED' });

    await expect(approveKyc('rider-1', 'admin-1')).rejects.toMatchObject({
      name: 'KycApproveError',
      code: 'INVALID_STATE',
    });
  });

  it('throws KycApproveError(INVALID_STATE) when KYC is REJECTED', async () => {
    mockFindByRiderId.mockResolvedValue({ ...SUBMITTED_KYC, status: 'REJECTED' });

    await expect(approveKyc('rider-1', 'admin-1')).rejects.toMatchObject({
      name: 'KycApproveError',
      code: 'INVALID_STATE',
    });
  });
});

describe('approveKyc use case — audit log is non-blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByRiderId.mockResolvedValue(SUBMITTED_KYC);
    mockApproveKycRepo.mockResolvedValue({ id: 'kyc-1', status: 'APPROVED' });
  });

  it('does not fail the use case if the audit log write throws', async () => {
    mockAuditLog.mockRejectedValueOnce(new Error('audit db down'));

    const result = await approveKyc('rider-1', 'admin-1');

    expect(result.status).toBe('APPROVED');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('audit log write failed'),
      expect.any(Object)
    );
  });
});
