import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { redactPii } from '@/lib/pii-redact';
import { getRequestContext } from '@/lib/correlation-id';

export const RETENTION_PERIODS: Record<string, number> = {
  auth: 90,
  kyc: 365,
  rider_update: 180,
  bulk_action: 365,
  system: 30,
  transaction: 2555,
  financial: 2555,
};

const DEFAULT_RETENTION_DAYS = 90;

function getRetentionDays(action: string): number {
  const [prefix, sub] = action.split('.');
  if (prefix === 'transaction' || prefix === 'financial' || prefix === 'wallet') {
    return RETENTION_PERIODS.transaction ?? 2555;
  }
  if (prefix === 'admin' && (sub === 'login' || sub === 'logout' || sub === 'auth')) {
    return RETENTION_PERIODS.auth ?? 90;
  }
  return RETENTION_PERIODS[prefix] ?? DEFAULT_RETENTION_DAYS;
}

export function getExpiresAt(action: string): Date {
  const days = getRetentionDays(action);
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

const CRITICAL_ACTIONS = new Set<string>([
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'PERMISSION_CHANGE',
  'ROLE_CHANGE',
  'SYSTEM_CONFIG',
]);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function createAuditLog(params: {
  actorId: string;
  actorType?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
}): Promise<void> {
  try {
    // CMP-004 (DPDP audit batch 15, 2026-09-02): redact PII at write time so
    // the database never persists raw Aadhaar / PAN / account / phone / email
    // values inside `details` or `entityId`. Before this fix, redaction only
    // happened at the admin GET read path (web/src/app/api/admin/audit-logs/
    // route.ts:50-68, PR-153) — leaving raw PII readable to anyone with DB
    // access and violating DPDP Act §8(4) (storage limitation).
    const redactedEntityId =
      params.entityId != null
        ? (redactPii(params.entityId) as string)
        : null;
    const reqCtx = getRequestContext();
    let detailsObj: any = null;
    if (params.details != null) {
      if (typeof params.details === 'string') {
        const parsed = parseIfJson(params.details);
        detailsObj = typeof parsed === 'object' && parsed !== null ? { ...(parsed as object) } : { raw: params.details };
      } else {
        detailsObj = { ...params.details };
      }
    } else if (reqCtx?.correlationId || reqCtx?.requestId) {
      detailsObj = {};
    }

    if (detailsObj && reqCtx) {
      if (reqCtx.correlationId && !detailsObj.correlationId) {
        detailsObj.correlationId = reqCtx.correlationId;
      }
      if (reqCtx.requestId && !detailsObj.requestId) {
        detailsObj.requestId = reqCtx.requestId;
      }
    }

    const redactedDetails = detailsObj ? JSON.stringify(redactPii(detailsObj)) : null;

    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorType: (params.actorType || 'ADMIN') as 'ADMIN' | 'SYSTEM' | 'RIDER',
        action: params.action,
        entity: params.entity,
        entityId: redactedEntityId,
        details: redactedDetails,
        expiresAt: getExpiresAt(params.action),
      },
    });
  } catch (err: unknown) {
    logger.error('[AuditLog] Failed to create entry:', err);
    if (CRITICAL_ACTIONS.has(params.action)) {
      throw new Error(
        `Audit log write failed for critical action ${params.action}: ${errorMessage(err)}`
      );
    }
    // CMP-004 (DPDP audit batch 15): the prior safeParams strip only removed
    // 5 keys (password / lockPassword / otp / idToken / token). Run the
    // full redactPii pass so Aadhaar / PAN / account / phone / email values
    // in `details` and `entityId` never reach stdout in the failure path.
    const redactedParams = redactPii(params);
    const { password, lockPassword, otp, idToken, token, ...safeParams } =
      redactedParams as Record<string, unknown>;
    console.error('[AUDIT_FAILED]', JSON.stringify(safeParams), errorMessage(err));
  }
}

/**
 * CMP-004 helper: parse a string as JSON if it looks like JSON, otherwise
 * return the raw string. Lets redactPii inspect structured keys inside an
 * already-stringified `details` payload before re-serialization.
 */
function parseIfJson(value: string): unknown {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    (trimmed[0] !== '{' && trimmed[0] !== '[')
  ) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export async function getExpiredLogs(): Promise<number> {
  try {
    const count = await db.auditLog.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return count;
  } catch (err) {
    logger.error('[AuditLog] Failed to count expired logs:', err);
    return 0;
  }
}

export async function deleteExpiredLogs(): Promise<number> {
  try {
    const result = await db.auditLog.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    if (result.count > 0) {
      logger.info(`[AuditLog] Deleted ${result.count} expired audit logs`);
    }
    return result.count;
  } catch (err) {
    logger.error('[AuditLog] Failed to delete expired logs:', err);
    return 0;
  }
}

export async function getRetentionStats(): Promise<Record<string, unknown>> {
  try {
    const now = new Date();
    const buckets = [
      { label: '0-7 days', days: 7 },
      { label: '7-30 days', days: 30 },
      { label: '30-90 days', days: 90 },
      { label: '90-180 days', days: 180 },
      { label: '180-365 days', days: 365 },
      { label: '365+ days', days: 9999 },
    ];

    const stats: Record<string, number> = {};
    let prevDate: Date | null = null;

    for (const bucket of buckets) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - bucket.days);

      const count = await db.auditLog.count({
        where: {
          createdAt: {
            gte: cutoff,
            lt: prevDate || now,
          },
          expiresAt: {
            gt: now,
          },
        },
      });

      stats[bucket.label] = count;
      prevDate = cutoff;
    }

    const expiredCount = await getExpiredLogs();

    return {
      active: stats,
      expired: expiredCount,
      retentionPeriods: RETENTION_PERIODS,
    };
  } catch (err) {
    logger.error('[AuditLog] Failed to get retention stats:', err);
    return { error: 'Failed to compute stats' };
  }
}

/**
 * Safely parses audit log details JSON field.
 */
export function parseAuditLogDetails<T = Record<string, unknown>>(
  details: string | null | undefined
): T | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as T;
  } catch {
    return null;
  }
}
