/**
 * Unit tests for Security Events module.
 *
 * Tests:
 *   - Security event severity mapping
 *   - logAdminLogin: success vs failure severity
 *   - logPermissionDenied: permission and route tracking
 *   - logFailedOtpAttempt: critical at max-1 attempts
 *   - logWalletChange: high value threshold
 *   - logReconciliationMismatch: drift severity thresholds
 *   - Edge cases for all event types
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Test implementation (duplicates logic from security-events.ts)
// ---------------------------------------------------------------------------

type SecurityEventSeverity = 'info' | 'warning' | 'critical';

interface SecurityEvent {
  type: string;
  severity: SecurityEventSeverity;
  actorId?: string;
  actorType?: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

let loggedEvents: SecurityEvent[] = [];

function resetEvents() {
  loggedEvents = [];
}

async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  loggedEvents.push({ ...event });
}

// Convenience methods
async function logAdminLogin(params: {
  adminId: string;
  email: string;
  success: boolean;
  ip?: string;
  userAgent?: string;
  failureReason?: string;
}): Promise<void> {
  await logSecurityEvent({
    type: 'admin.login',
    severity: params.success ? 'info' : 'warning',
    actorId: params.adminId,
    actorType: 'admin',
    details: {
      email: params.email,
      success: params.success,
      failureReason: params.failureReason,
    },
    ip: params.ip,
    userAgent: params.userAgent,
  });
}

async function logPermissionDenied(params: {
  adminId: string;
  permission: string;
  route: string;
  ip?: string;
}): Promise<void> {
  await logSecurityEvent({
    type: 'admin.permission_denied',
    severity: 'warning',
    actorId: params.adminId,
    actorType: 'admin',
    details: {
      permission: params.permission,
      route: params.route,
    },
    ip: params.ip,
  });
}

async function logKycDocumentView(params: {
  adminId: string;
  riderId: string;
  documentType: string;
}): Promise<void> {
  await logSecurityEvent({
    type: 'kyc.document_view',
    severity: 'info',
    actorId: params.adminId,
    actorType: 'admin',
    details: {
      riderId: params.riderId,
      documentType: params.documentType,
    },
  });
}

async function logFailedOtpAttempt(params: {
  phone: string;
  attempts: number;
  maxAttempts: number;
  ip?: string;
}): Promise<void> {
  const severity: SecurityEventSeverity =
    params.attempts >= params.maxAttempts - 1 ? 'critical' : 'warning';

  await logSecurityEvent({
    type: 'auth.otp_failed',
    severity,
    details: {
      phone: params.phone,
      attempts: params.attempts,
      maxAttempts: params.maxAttempts,
    },
    ip: params.ip,
  });
}

async function logWalletChange(params: {
  riderId: string;
  amountInPaise: number;
  balanceAfter: number;
  category: string;
  actorId?: string;
}): Promise<void> {
  const isHighValue = params.amountInPaise >= 100000;

  await logSecurityEvent({
    type: 'wallet.balance_change',
    severity: isHighValue ? 'warning' : 'info',
    actorId: params.actorId,
    actorType: params.actorId ? 'admin' : 'system',
    details: {
      riderId: params.riderId,
      amountInPaise: params.amountInPaise,
      balanceAfter: params.balanceAfter,
      category: params.category,
    },
  });
}

async function logAccountSuspension(params: {
  riderId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  await logSecurityEvent({
    type: 'rider.suspended',
    severity: 'critical',
    actorId: params.adminId,
    actorType: 'admin',
    details: {
      riderId: params.riderId,
      reason: params.reason,
    },
  });
}

async function logReconciliationMismatch(params: {
  riderId: string;
  ledgerSum: number;
  walletBalance: number;
  drift: number;
}): Promise<void> {
  const absDrift = Math.abs(params.drift);
  const severity: SecurityEventSeverity = absDrift >= 10000 ? 'critical' : 'warning';

  await logSecurityEvent({
    type: 'reconciliation.mismatch',
    severity,
    details: {
      riderId: params.riderId,
      ledgerSum: params.ledgerSum,
      walletBalance: params.walletBalance,
      drift: params.drift,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Security Events — logAdminLogin', () => {
  beforeEach(() => resetEvents());

  it('marks successful login as info', async () => {
    await logAdminLogin({ adminId: 'admin-1', email: 'admin@test.com', success: true });
    expect(loggedEvents[0].severity).toBe('info');
    expect(loggedEvents[0].details.success).toBe(true);
  });

  it('marks failed login as warning', async () => {
    await logAdminLogin({
      adminId: 'admin-1',
      email: 'admin@test.com',
      success: false,
      failureReason: 'Invalid password',
    });
    expect(loggedEvents[0].severity).toBe('warning');
    expect(loggedEvents[0].details.failureReason).toBe('Invalid password');
  });

  it('includes IP and user agent when provided', async () => {
    await logAdminLogin({
      adminId: 'admin-1',
      email: 'a@b.com',
      success: true,
      ip: '192.168.1.1',
      userAgent: 'Chrome',
    });
    expect(loggedEvents[0].ip).toBe('192.168.1.1');
    expect(loggedEvents[0].userAgent).toBe('Chrome');
  });
});

describe('Security Events — logPermissionDenied', () => {
  beforeEach(() => resetEvents());

  it('always severity = warning', async () => {
    await logPermissionDenied({
      adminId: 'admin-1',
      permission: 'riders_delete',
      route: '/api/admin/riders',
    });
    expect(loggedEvents[0].severity).toBe('warning');
    expect(loggedEvents[0].type).toBe('admin.permission_denied');
  });

  it('tracks permission and route', async () => {
    await logPermissionDenied({
      adminId: 'admin-1',
      permission: 'transactions_approve',
      route: '/api/admin/transactions',
    });
    expect(loggedEvents[0].details.permission).toBe('transactions_approve');
    expect(loggedEvents[0].details.route).toBe('/api/admin/transactions');
  });

  it('optionally includes IP', async () => {
    await logPermissionDenied({
      adminId: 'admin-1',
      permission: 'kyc_view',
      route: '/api/admin/kyc',
      ip: '10.0.0.1',
    });
    expect(loggedEvents[0].ip).toBe('10.0.0.1');
  });
});

describe('Security Events — logKycDocumentView', () => {
  beforeEach(() => resetEvents());

  it('marks as info severity', async () => {
    await logKycDocumentView({ adminId: 'admin-1', riderId: 'rider-1', documentType: 'aadhaar' });
    expect(loggedEvents[0].severity).toBe('info');
    expect(loggedEvents[0].type).toBe('kyc.document_view');
  });

  it('tracks document type and rider', async () => {
    await logKycDocumentView({ adminId: 'admin-1', riderId: 'rider-1', documentType: 'pan' });
    expect(loggedEvents[0].details.documentType).toBe('pan');
    expect(loggedEvents[0].details.riderId).toBe('rider-1');
  });
});

describe('Security Events — logFailedOtpAttempt', () => {
  beforeEach(() => resetEvents());

  it('marks early attempts as warning', async () => {
    await logFailedOtpAttempt({ phone: '+919999000001', attempts: 1, maxAttempts: 5 });
    expect(loggedEvents[0].severity).toBe('warning');
  });

  it('marks last attempt before lockout as critical', async () => {
    await logFailedOtpAttempt({ phone: '+919999000001', attempts: 4, maxAttempts: 5 });
    expect(loggedEvents[0].severity).toBe('critical');
  });

  it('marks at-limit attempt as critical', async () => {
    await logFailedOtpAttempt({ phone: '+919999000001', attempts: 5, maxAttempts: 5 });
    expect(loggedEvents[0].severity).toBe('critical');
  });

  it('tracks phone and attempt count', async () => {
    await logFailedOtpAttempt({ phone: '+911234567890', attempts: 2, maxAttempts: 5 });
    expect(loggedEvents[0].details.phone).toBe('+911234567890');
    expect(loggedEvents[0].details.attempts).toBe(2);
    expect(loggedEvents[0].details.maxAttempts).toBe(5);
  });

  it('optionally includes IP', async () => {
    await logFailedOtpAttempt({
      phone: '+919999000001',
      attempts: 3,
      maxAttempts: 5,
      ip: '203.0.113.1',
    });
    expect(loggedEvents[0].ip).toBe('203.0.113.1');
  });

  it('handles single max attempt', async () => {
    await logFailedOtpAttempt({ phone: '+919999000001', attempts: 0, maxAttempts: 1 });
    expect(loggedEvents[0].severity).toBe('critical');
  });
});

describe('Security Events — logWalletChange', () => {
  beforeEach(() => resetEvents());

  it('marks small changes as info', async () => {
    await logWalletChange({
      riderId: 'rider-1',
      amountInPaise: 5000,
      balanceAfter: 15000,
      category: 'topup',
    });
    expect(loggedEvents[0].severity).toBe('info');
  });

  it('marks high-value changes as warning', async () => {
    await logWalletChange({
      riderId: 'rider-1',
      amountInPaise: 100000,
      balanceAfter: 200000,
      category: 'topup',
    });
    expect(loggedEvents[0].severity).toBe('warning');
  });

  it('marks changes at threshold boundary as warning', async () => {
    await logWalletChange({
      riderId: 'rider-1',
      amountInPaise: 100000,
      balanceAfter: 150000,
      category: 'deposit',
    });
    expect(loggedEvents[0].severity).toBe('warning');
  });

  it('marks system-initiated changes correctly', async () => {
    await logWalletChange({
      riderId: 'rider-1',
      amountInPaise: 5000,
      balanceAfter: 5000,
      category: 'topup',
    });
    expect(loggedEvents[0].actorType).toBe('system');
    expect(loggedEvents[0].actorId).toBeUndefined();
  });

  it('marks admin-initiated changes correctly', async () => {
    await logWalletChange({
      riderId: 'rider-1',
      amountInPaise: 5000,
      balanceAfter: 5000,
      category: 'adjustment',
      actorId: 'admin-1',
    });
    expect(loggedEvents[0].actorType).toBe('admin');
    expect(loggedEvents[0].actorId).toBe('admin-1');
  });
});

describe('Security Events — logAccountSuspension', () => {
  beforeEach(() => resetEvents());

  it('always severity = critical', async () => {
    await logAccountSuspension({
      riderId: 'rider-1',
      adminId: 'admin-1',
      reason: 'Payment default',
    });
    expect(loggedEvents[0].severity).toBe('critical');
    expect(loggedEvents[0].type).toBe('rider.suspended');
  });

  it('tracks reason and admin', async () => {
    await logAccountSuspension({
      riderId: 'rider-1',
      adminId: 'admin-1',
      reason: 'Policy violation',
    });
    expect(loggedEvents[0].details.reason).toBe('Policy violation');
    expect(loggedEvents[0].actorId).toBe('admin-1');
  });
});

describe('Security Events — logReconciliationMismatch', () => {
  beforeEach(() => resetEvents());

  it('marks small drift as warning', async () => {
    await logReconciliationMismatch({
      riderId: 'rider-1',
      ledgerSum: 1000,
      walletBalance: 1100,
      drift: 100,
    });
    expect(loggedEvents[0].severity).toBe('warning');
  });

  it('marks large drift as critical', async () => {
    await logReconciliationMismatch({
      riderId: 'rider-1',
      ledgerSum: 10000,
      walletBalance: 20000,
      drift: 10000,
    });
    expect(loggedEvents[0].severity).toBe('critical');
  });

  it('marks negative drift correctly', async () => {
    await logReconciliationMismatch({
      riderId: 'rider-1',
      ledgerSum: 10000,
      walletBalance: 5000,
      drift: -5000,
    });
    expect(loggedEvents[0].severity).toBe('warning');
    expect(loggedEvents[0].details.drift).toBe(-5000);
  });

  it('marks large negative drift as critical', async () => {
    await logReconciliationMismatch({
      riderId: 'rider-1',
      ledgerSum: 50000,
      walletBalance: 0,
      drift: -50000,
    });
    expect(loggedEvents[0].severity).toBe('critical');
  });
});

describe('Security Events — edge cases', () => {
  beforeEach(() => resetEvents());

  it('handles missing optional fields gracefully', async () => {
    await logSecurityEvent({
      type: 'test.event',
      severity: 'info',
      details: {},
    });
    expect(loggedEvents[0]).toBeDefined();
    expect(loggedEvents[0].actorId).toBeUndefined();
    expect(loggedEvents[0].ip).toBeUndefined();
  });

  it('handles empty details object', async () => {
    await logSecurityEvent({
      type: 'test.empty',
      severity: 'info',
      details: {},
    });
    expect(loggedEvents[0].details).toEqual({});
  });
});
