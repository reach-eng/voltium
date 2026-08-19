/**
 * Ticket #45 — security-events.ts PII leak in audit log + application logger
 *
 * Audit claim: every security event leaks PII because `details` is spread
 * raw into the application logger context AND into the audit log.
 *
 * Fix: redact at the source using `redactPii` so both paths get the
 * same full `[REDACTED]` treatment. Previously the audit log was
 * redacted but the app logger used a weaker `****1234` mask.
 *
 * This test imports the REAL `logSecurityEvent` from the source module
 * and asserts that PII fields in `details` are redacted in BOTH:
 *   1. The pino application logger
 *   2. The audit log row's `details` column
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the audit log + logger BEFORE importing the module under test
const mockCreateAuditLog = vi.fn();
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

const capturedLog: Array<{ level: string; context: unknown; message: string }> = [];
vi.mock('@/lib/logger', () => ({
  logger: {
    info: (message: string, context: unknown) => capturedLog.push({ level: 'info', context, message }),
    warn: (message: string, context: unknown) => capturedLog.push({ level: 'warn', context, message }),
    error: (message: string, context: unknown) => capturedLog.push({ level: 'error', context, message }),
    debug: (message: string, context: unknown) => capturedLog.push({ level: 'debug', context, message }),
  },
}));

import { logSecurityEvent, logAdminLogin, logFailedOtpAttempt, logPermissionDenied, logAccountSuspension } from '@/lib/security-events';

describe('security-events — PII redaction in app logger and audit log (#45)', () => {
  beforeEach(() => {
    mockCreateAuditLog.mockReset();
    mockCreateAuditLog.mockResolvedValue(undefined);
    capturedLog.length = 0;
  });

  it('redacts phone in details when passed to logSecurityEvent', async () => {
    await logSecurityEvent({
      type: 'test.pii',
      severity: 'info',
      details: { phone: '9876543210', note: 'some other context' },
    });

    // Application logger must have redacted phone
    const logEntry = capturedLog.find((e) => e.message.includes('test.pii'));
    expect(logEntry).toBeDefined();
    const ctx = logEntry!.context as Record<string, unknown>;
    expect(ctx.phone).toBe('[REDACTED]');
    expect(ctx.note).toBe('some other context'); // non-PII preserved

    // Audit log row must have redacted phone
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    const auditDetails = JSON.parse(auditArgs.details);
    expect(auditDetails.phone).toBe('[REDACTED]');
    expect(auditDetails.note).toBe('some other context');
  });

  it('redacts email in details from logAdminLogin', async () => {
    await logAdminLogin({
      adminId: 'admin-123',
      email: 'sensitive@example.com',
      success: true,
      ip: '1.2.3.4',
    });

    const logEntry = capturedLog.find((e) => e.message.includes('admin.login'));
    expect(logEntry).toBeDefined();
    const ctx = logEntry!.context as Record<string, unknown>;
    expect(ctx.email).toBe('[REDACTED]');

    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    const auditDetails = JSON.parse(auditArgs.details);
    expect(auditDetails.email).toBe('[REDACTED]');
  });

  it('redacts phone in details from logFailedOtpAttempt', async () => {
    await logFailedOtpAttempt({
      phone: '+919876543210',
      attempts: 3,
      maxAttempts: 5,
    });

    const logEntry = capturedLog.find((e) => e.message.includes('auth.otp_failed'));
    expect(logEntry).toBeDefined();
    const ctx = logEntry!.context as Record<string, unknown>;
    expect(ctx.phone).toBe('[REDACTED]');

    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    const auditDetails = JSON.parse(auditArgs.details);
    expect(auditDetails.phone).toBe('[REDACTED]');
  });

  it('redacts nested PII in details object', async () => {
    await logSecurityEvent({
      type: 'test.nested',
      severity: 'warning',
      details: {
        context: {
          user: { email: 'nested@example.com', phone: '9876543210' },
          action: 'login',
        },
      },
    });

    const logEntry = capturedLog.find((e) => e.message.includes('test.nested'));
    const ctx = logEntry!.context as Record<string, unknown>;
    const nested = ctx.context as { user: { email: string; phone: string } };
    expect(nested.user.email).toBe('[REDACTED]');
    expect(nested.user.phone).toBe('[REDACTED]');
    expect(nested.action).toBe('login');

    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    const auditDetails = JSON.parse(auditArgs.details);
    expect(auditDetails.context.user.email).toBe('[REDACTED]');
    expect(auditDetails.context.user.phone).toBe('[REDACTED]');
  });

  it('preserves non-PII fields unchanged in both paths', async () => {
    await logSecurityEvent({
      type: 'test.mixed',
      severity: 'info',
      details: {
        action: 'permission_check',
        permission: 'admin:read',
        count: 42,
        allowed: true,
      },
    });

    const logEntry = capturedLog.find((e) => e.message.includes('test.mixed'));
    const ctx = logEntry!.context as Record<string, unknown>;
    expect(ctx.action).toBe('permission_check');
    expect(ctx.permission).toBe('admin:read');
    expect(ctx.count).toBe(42);
    expect(ctx.allowed).toBe(true);

    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    const auditDetails = JSON.parse(auditArgs.details);
    expect(auditDetails.action).toBe('permission_check');
    expect(auditDetails.count).toBe(42);
  });

  it('does NOT leak partial PII (****1234) in app logger', async () => {
    // Specifically: the audit was that the pino formatter's `maskSensitiveData`
    // was leaking last-4 of phone. After the fix, phone is fully `[REDACTED]`.
    await logSecurityEvent({
      type: 'test.partial',
      severity: 'info',
      details: { phone: '9876543210' },
    });

    const logEntry = capturedLog.find((e) => e.message.includes('test.partial'));
    const ctx = logEntry!.context as Record<string, unknown>;
    // Phone value should be EXACTLY '[REDACTED]', not '****3210'
    expect(ctx.phone).toBe('[REDACTED]');
    expect(String(ctx.phone)).not.toMatch(/^\*+3210$/);
  });

  it('still writes to audit log even when redaction is empty', async () => {
    await logSecurityEvent({
      type: 'test.empty',
      severity: 'info',
      details: {},
    });

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    const auditDetails = JSON.parse(auditArgs.details);
    expect(auditDetails).toBeDefined();
  });

  it('info-severity events are written to audit log (ticket #53 SOC2 compliance)', async () => {
    // SOC2 requires that all security-relevant events are audit-logged,
    // not just warnings and criticals. This test ensures info events
    // (e.g. successful admin login) get persisted.
    await logAdminLogin({
      adminId: 'admin-1',
      email: 'admin@example.com',
      success: true,
    });

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    // P3-10: audit action is the enum-valid SECURITY_EVENT; the specific kind
    // lives in details.eventType (the old dot-string could never be stored).
    expect(auditArgs.action).toBe('SECURITY_EVENT');
    expect(auditArgs.entity).toBe('securityEvent');
    expect(JSON.parse(auditArgs.details).eventType).toBe('admin.login');
  });

  it('warning-severity events are written to audit log', async () => {
    await logPermissionDenied({
      adminId: 'admin-2',
      permission: 'admin:read',
      route: '/api/admin/rider',
    });

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    expect(auditArgs.action).toBe('SECURITY_EVENT');
    expect(JSON.parse(auditArgs.details).eventType).toBe('admin.permission_denied');
  });

  it('critical-severity events are written to audit log', async () => {
    await logAccountSuspension({
      riderId: 'rider-1',
      adminId: 'admin-3',
      reason: 'fraud',
    });

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    const auditArgs = mockCreateAuditLog.mock.calls[0][0];
    expect(auditArgs.action).toBe('SECURITY_EVENT');
    expect(JSON.parse(auditArgs.details).eventType).toBe('rider.suspended');
  });
});
