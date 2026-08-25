import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const RETENTION_PERIODS: Record<string, number> = {
  auth: 90,
  admin: 90,
  kyc: 365,
  rider_update: 180,
  bulk_action: 365,
  transaction: 365,
  wallet: 365,
  finance: 365,
  payment: 365,
  system: 30,
  sos: 30,
  emergency: 30,
};

const DEFAULT_RETENTION_DAYS = 90;

function getRetentionDays(action: string): number {
  const actionType = action.split('.')[0];
  if (RETENTION_PERIODS[actionType]) {
    return RETENTION_PERIODS[actionType];
  }
  if (action.includes('sos') || action.includes('emergency')) {
    return RETENTION_PERIODS.emergency ?? 30;
  }
  if (action.includes('login') || action.includes('auth')) {
    return RETENTION_PERIODS.auth ?? 90;
  }
  if (action.includes('transaction') || action.includes('payment') || action.includes('wallet') || action.includes('finance')) {
    return RETENTION_PERIODS.transaction ?? 365;
  }
  return DEFAULT_RETENTION_DAYS;
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

export async function createAuditLog(
  params: {
    actorId: string;
    actorType?: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: string | Record<string, unknown>;
  },
  tx?: any
): Promise<void> {
  const client = tx || db;
  try {
    await client.auditLog.create({
      data: {
        actorId: params.actorId,
        actorType: (params.actorType || 'ADMIN') as 'ADMIN' | 'SYSTEM' | 'RIDER',
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        details:
          typeof params.details === 'string'
            ? params.details
            : params.details
              ? JSON.stringify(params.details)
              : null,
        expiresAt: getExpiresAt(params.action),
      },
    });
  } catch (err: unknown) {
    logger.error('[AuditLog] Failed to create entry:', err);
    if (tx || CRITICAL_ACTIONS.has(params.action)) {
      throw new Error(
        `Audit log write failed for critical action ${params.action}: ${errorMessage(err)}`
      );
    }
    const { password, lockPassword, otp, idToken, token, ...safeParams } = params as Record<string, unknown>;
    console.error('[AUDIT_FAILED]', JSON.stringify(safeParams), errorMessage(err));
  }
}

/**
 * Standard audit logger for administrative mutation endpoints.
 * Extracts the actor ID from session payload or falls back safely.
 */
export async function logAdminMutation(params: {
  session?: { adminId?: string; riderDbId?: string; role?: string; adminRole?: string; id?: string; email?: string } | null;
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
  tx?: any;
}): Promise<void> {
  const actorId =
    params.actorId ||
    params.session?.adminId ||
    params.session?.riderDbId ||
    params.session?.id ||
    params.session?.email ||
    'system';

  await createAuditLog(
    {
      actorId,
      actorType: 'ADMIN',
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
    },
    params.tx
  );
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
