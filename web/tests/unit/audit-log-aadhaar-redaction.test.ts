import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  auditLog: {
    create: vi.fn(),
  },
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

const { createAuditLog } = await import('@/lib/audit-log');

describe('createAuditLog — PII & Aadhaar Redaction (SEC-010)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.auditLog.create.mockResolvedValue({ id: 'log_123' });
  });

  it('redacts Aadhaar and PAN numbers when passed as details object', async () => {
    await createAuditLog({
      actorId: 'adm_1',
      action: 'kyc.review',
      entity: 'Rider',
      entityId: 'rd_999',
      details: {
        aadhaarNumber: '123456789012',
        panNumber: 'ABCDE1234F',
        riderName: 'John Doe',
        phone: '+919876543210',
      },
    });

    expect(mockDb.auditLog.create).toHaveBeenCalledTimes(1);
    const createCall = mockDb.auditLog.create.mock.calls[0][0];
    const details = JSON.parse(createCall.data.details);

    expect(details.aadhaarNumber).toBe('[REDACTED]');
    expect(details.panNumber).toBe('[REDACTED]');
    expect(details.phone).toBe('[REDACTED]');
    expect(details.riderName).toBe('John Doe');
  });

  it('redacts Aadhaar and sensitive keys when passed as JSON string', async () => {
    await createAuditLog({
      actorId: 'adm_1',
      action: 'kyc.update',
      entity: 'Rider',
      entityId: 'rd_999',
      details: JSON.stringify({
        aadhaar: '987654321098',
        accountNumber: '112233445566',
        status: 'VERIFIED',
      }),
    });

    const createCall = mockDb.auditLog.create.mock.calls[0][0];
    const details = JSON.parse(createCall.data.details);

    expect(details.aadhaar).toBe('[REDACTED]');
    expect(details.accountNumber).toBe('[REDACTED]');
    expect(details.status).toBe('VERIFIED');
  });

  it('redacts PII in safeParams on audit write error fallback', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDb.auditLog.create.mockRejectedValueOnce(new Error('DB write failed'));

    await createAuditLog({
      actorId: 'adm_1',
      action: 'non_critical_view',
      entity: 'Rider',
      details: {
        aadhaarNumber: '123456789012',
        password: 'secretPassword123',
      },
    });

    expect(consoleSpy).toHaveBeenCalled();
    const loggedStr = consoleSpy.mock.calls[0][1];
    expect(loggedStr).toContain('[REDACTED]');
    expect(loggedStr).not.toContain('123456789012');
    expect(loggedStr).not.toContain('secretPassword123');

    consoleSpy.mockRestore();
  });
});
