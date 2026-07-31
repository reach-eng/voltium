/**
 * Security Event Logger
 *
 * Logs security-relevant events (auth, permissions, suspicious activity)
 * to both the application logger and the audit log table for SIEM integration.
 *
 * Events logged:
 *   - Admin login/logout
 *   - Admin approval/rejection (KYC, deposits, etc.)
 *   - KYC document views
 *   - Wallet balance changes
 *   - Failed OTP attempts (near rate limit)
 *   - Permission denied events
 *   - Suspicious activity patterns
 */

import { logger } from './logger';
import { createAuditLog } from './audit-log';

export type SecurityEventSeverity = 'info' | 'warning' | 'critical';

export interface SecurityEvent {
  type: string;
  severity: SecurityEventSeverity;
  actorId?: string;
  actorType?: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

const SECURITY_EVENT_PREFIX = '[Security]';

/**
 * Core security event logging function.
 * Writes to both the application logger and the audit log table.
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  const { type, severity, actorId, actorType, details, ip, userAgent, correlationId } = event;

  const logContext: Record<string, unknown> = {
    eventType: type,
    severity,
    actorId: actorId || 'anonymous',
    ...details,
  };

  if (ip) logContext.ip = ip;
  if (userAgent) logContext.userAgent = userAgent;
  if (correlationId) logContext.correlationId = correlationId;

  // Log to application logger with appropriate level
  const message = `${SECURITY_EVENT_PREFIX} ${type}`;

  switch (severity) {
    case 'critical':
      logger.error(message, logContext);
      break;
    case 'warning':
      logger.warn(message, logContext);
      break;
    default:
      logger.info(message, logContext);
  }

  // For critical events, also write to audit log table for persistence
  if (severity === 'critical' || severity === 'warning') {
    try {
      await createAuditLog({
        actorId: actorId || 'SYSTEM',
        actorType: actorType || 'SYSTEM',
        action: `security.${type}`,
        entity: 'securityEvent',
        entityId: undefined,
        details: JSON.stringify({
          severity,
          ...details,
          ip,
          userAgent,
          correlationId,
        }),
      });
    } catch (err) {
      logger.error('[SecurityEvents] Failed to write audit log', { eventType: type, err });
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience methods for specific security events
// ---------------------------------------------------------------------------

/**
 * Log an admin login event.
 */
export async function logAdminLogin(params: {
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
    actorType: 'ADMIN',
    details: {
      email: params.email,
      success: params.success,
      failureReason: params.failureReason,
    },
    ip: params.ip,
    userAgent: params.userAgent,
  });
}

/**
 * Log an admin permission denied event.
 */
export async function logPermissionDenied(params: {
  adminId: string;
  permission: string;
  route: string;
  ip?: string;
}): Promise<void> {
  await logSecurityEvent({
    type: 'admin.permission_denied',
    severity: 'warning',
    actorId: params.adminId,
    actorType: 'ADMIN',
    details: {
      permission: params.permission,
      route: params.route,
    },
    ip: params.ip,
  });
}

/**
 * Log a KYC document view by an admin.
 */
export async function logKycDocumentView(params: {
  adminId: string;
  riderId: string;
  documentType: string;
}): Promise<void> {
  await logSecurityEvent({
    type: 'kyc.document_view',
    severity: 'info',
    actorId: params.adminId,
    actorType: 'ADMIN',
    details: {
      riderId: params.riderId,
      documentType: params.documentType,
    },
  });
}

/**
 * Log a failed OTP attempt (when rate limit is nearly reached).
 */
export async function logFailedOtpAttempt(params: {
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

/**
 * Log a wallet balance change (significant amounts).
 */
export async function logWalletChange(params: {
  riderId: string;
  amountInPaise: number;
  balanceAfter: number;
  category: string;
  actorId?: string;
}): Promise<void> {
  const isHighValue = params.amountInPaise >= 100000; // ₹1000+

  await logSecurityEvent({
    type: 'wallet.balance_change',
    severity: isHighValue ? 'warning' : 'info',
    actorId: params.actorId,
    actorType: params.actorId ? 'ADMIN' : 'SYSTEM',
    details: {
      riderId: params.riderId,
      amountInPaise: params.amountInPaise,
      balanceAfter: params.balanceAfter,
      category: params.category,
    },
  });
}

/**
 * Log a suspended account event.
 */
export async function logAccountSuspension(params: {
  riderId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  await logSecurityEvent({
    type: 'rider.suspended',
    severity: 'critical',
    actorId: params.adminId,
    actorType: 'ADMIN',
    details: {
      riderId: params.riderId,
      reason: params.reason,
    },
  });
}

/**
 * Log a reconciliation mismatch (potential fraud indicator).
 */
export async function logReconciliationMismatch(params: {
  riderId: string;
  ledgerSum: number;
  walletBalance: number;
  drift: number;
}): Promise<void> {
  const absDrift = Math.abs(params.drift);
  const severity: SecurityEventSeverity = absDrift >= 10000 ? 'critical' : 'warning'; // ₹100+ drift is critical

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
